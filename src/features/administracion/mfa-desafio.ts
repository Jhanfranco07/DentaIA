import type { SupabaseClient } from "@supabase/supabase-js";

type Auth = Pick<SupabaseClient["auth"], "getUser" | "getSession" | "mfa">;

export type ErrorMfaDesafio =
  | "SESION_INVALIDA"
  | "FACTOR_NO_DISPONIBLE"
  | "CODIGO_INVALIDO"
  | "CODIGO_RECHAZADO"
  | "DESAFIO_CADUCADO"
  | "LIMITE_INTENTOS"
  | "RED_NO_DISPONIBLE"
  | "SERVICIO_NO_DISPONIBLE"
  | "VERIFICACION_RECHAZADA"
  | "NO_AAL2";

type ErrorAuthSeguro = { code?: unknown; status?: unknown; name?: unknown };

/** Clasifica únicamente campos estructurados de Auth; nunca lee ni propaga el mensaje remoto. */
function clasificarErrorAuth(error: unknown): ErrorMfaDesafio {
  if (!error || typeof error !== "object") return "VERIFICACION_RECHAZADA";
  const seguro = error as ErrorAuthSeguro;
  const codigo = typeof seguro.code === "string" ? seguro.code.toLowerCase() : "";
  const nombre = typeof seguro.name === "string" ? seguro.name : "";
  const estado = typeof seguro.status === "number" ? seguro.status : undefined;

  if (estado === 429 || codigo === "over_request_rate_limit") return "LIMITE_INTENTOS";
  if (["session_expired", "session_not_found", "bad_jwt", "refresh_token_not_found", "refresh_token_already_used"].includes(codigo)
    || estado === 401) return "SESION_INVALIDA";
  if (codigo === "mfa_challenge_expired") return "DESAFIO_CADUCADO";
  if (["mfa_factor_not_found", "mfa_factor_not_verified"].includes(codigo)) return "FACTOR_NO_DISPONIBLE";
  if (["mfa_verification_failed", "mfa_verification_rejected"].includes(codigo)) return "CODIGO_RECHAZADO";
  if (estado !== undefined && estado >= 500) return "SERVICIO_NO_DISPONIBLE";
  if (nombre === "AuthRetryableFetchError" && (!estado || estado === 0)) return "RED_NO_DISPONIBLE";
  if (codigo === "request_timeout" || codigo === "fetch_error" || codigo === "network_error") return "RED_NO_DISPONIBLE";
  return "VERIFICACION_RECHAZADA";
}

export class FalloMfaDesafio extends Error {
  readonly codigo: ErrorMfaDesafio;
  constructor(codigo: ErrorMfaDesafio) {
    super(codigo);
    this.codigo = codigo;
    this.name = "FalloMfaDesafio";
  }
}

/** Step-up TOTP para la sesión actual. No enrola, elimina ni modifica factores. */
export function crearDesafioMfaAdministrativo(crearAuth: () => Auth) {
  async function identidadVigente() {
    const auth = crearAuth();
    const [{ data: usuario, error: errorUsuario }, { data: sesion, error: errorSesion }] = await Promise.all([
      auth.getUser(), auth.getSession(),
    ]);
    if (errorUsuario || errorSesion || !usuario.user || !sesion.session
      || usuario.user.id !== sesion.session.user.id || usuario.user.aud !== "authenticated"
      || usuario.user.is_anonymous || !usuario.user.confirmed_at
      || !sesion.session.expires_at || sesion.session.expires_at * 1000 <= Date.now()) {
      throw new FalloMfaDesafio("SESION_INVALIDA");
    }
    return { auth, usuarioId: usuario.user.id };
  }

  async function factoresVerificados() {
    const { auth } = await identidadVigente();
    const { data, error } = await auth.mfa.listFactors();
    if (error) throw new FalloMfaDesafio(clasificarErrorAuth(error));
    if (!data || !Array.isArray(data.totp)) throw new FalloMfaDesafio("FACTOR_NO_DISPONIBLE");
    return data.totp.filter(factor => factor.status === "verified").map(({ id }) => id);
  }

  async function verificar(factorId: string, codigo: string) {
    if (!/^\d{6}$/.test(codigo)) throw new FalloMfaDesafio("CODIGO_INVALIDO");
    const { auth, usuarioId } = await identidadVigente();
    const { data, error } = await auth.mfa.listFactors();
    const factor = data?.totp?.find(item => item.id === factorId && item.status === "verified");
    if (error) throw new FalloMfaDesafio(clasificarErrorAuth(error));
    if (!factor) throw new FalloMfaDesafio("FACTOR_NO_DISPONIBLE");

    try {
      const { error: errorVerificacion } = await auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
      if (errorVerificacion) throw new FalloMfaDesafio(clasificarErrorAuth(errorVerificacion));
    } catch (errorVerificacion) {
      if (errorVerificacion instanceof FalloMfaDesafio) throw errorVerificacion;
      throw new FalloMfaDesafio(clasificarErrorAuth(errorVerificacion));
    }

    // Auth SDK debe conservar y elevar la sesión real; nunca se simula un claim AAL.
    const [{ data: actual, error: errorActual }, { data: nivel, error: errorNivel }] = await Promise.all([
      auth.getUser(), auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (errorActual || errorNivel || actual.user?.id !== usuarioId || nivel.currentLevel !== "aal2") {
      throw new FalloMfaDesafio("NO_AAL2");
    }
    return true;
  }

  return { factoresVerificados, verificar };
}

export function mensajeFalloMfaDesafio(error: unknown): string {
  const codigo = error instanceof FalloMfaDesafio ? error.codigo : "";
  const mensajes: Record<ErrorMfaDesafio, string> = {
    SESION_INVALIDA: "La sesión no es válida o venció. Inicia sesión de nuevo.",
    FACTOR_NO_DISPONIBLE: "No hay un factor TOTP verificado disponible para esta cuenta. Solicita la configuración MFA por el procedimiento autorizado.",
    CODIGO_INVALIDO: "Introduce el código actual de seis dígitos de tu autenticador.",
    CODIGO_RECHAZADO: "El autenticador rechazó el código. Comprueba que sea el actual e inténtalo de nuevo.",
    DESAFIO_CADUCADO: "El desafío de verificación venció. Solicita uno nuevo e inténtalo otra vez.",
    LIMITE_INTENTOS: "Se alcanzó el límite de intentos. Espera antes de volver a intentarlo.",
    RED_NO_DISPONIBLE: "No se pudo conectar con el servicio de autenticación. Comprueba tu conexión e inténtalo de nuevo.",
    SERVICIO_NO_DISPONIBLE: "El servicio de autenticación no está disponible temporalmente. Inténtalo más tarde.",
    VERIFICACION_RECHAZADA: "El código no fue aceptado. Comprueba el código actual e inténtalo de nuevo.",
    NO_AAL2: "Supabase no confirmó AAL2. El acceso administrativo continúa bloqueado.",
  };
  return codigo in mensajes ? mensajes[codigo as ErrorMfaDesafio]
    : "No se pudo completar la verificación MFA. El acceso administrativo sigue bloqueado.";
}
