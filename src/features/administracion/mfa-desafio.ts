import type { SupabaseClient } from "@supabase/supabase-js";

type Auth = Pick<SupabaseClient["auth"], "getUser" | "getSession" | "mfa">;

export type ErrorMfaDesafio = "SESION_INVALIDA" | "FACTOR_NO_DISPONIBLE" | "CODIGO_INVALIDO" | "VERIFICACION_RECHAZADA" | "NO_AAL2";

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
    if (error || !data || !Array.isArray(data.totp)) throw new FalloMfaDesafio("FACTOR_NO_DISPONIBLE");
    return data.totp.filter(factor => factor.status === "verified").map(({ id }) => id);
  }

  async function verificar(factorId: string, codigo: string) {
    if (!/^\d{6}$/.test(codigo)) throw new FalloMfaDesafio("CODIGO_INVALIDO");
    const { auth, usuarioId } = await identidadVigente();
    const { data, error } = await auth.mfa.listFactors();
    const factor = data?.totp?.find(item => item.id === factorId && item.status === "verified");
    if (error || !factor) throw new FalloMfaDesafio("FACTOR_NO_DISPONIBLE");

    const { error: errorVerificacion } = await auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
    if (errorVerificacion) throw new FalloMfaDesafio("VERIFICACION_RECHAZADA");

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
    VERIFICACION_RECHAZADA: "El código no fue aceptado. Comprueba el código actual e inténtalo de nuevo.",
    NO_AAL2: "Supabase no confirmó AAL2. El acceso administrativo continúa bloqueado.",
  };
  return codigo in mensajes ? mensajes[codigo as ErrorMfaDesafio]
    : "No se pudo completar la verificación MFA. El acceso administrativo sigue bloqueado.";
}
