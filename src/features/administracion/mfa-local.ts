import type { SupabaseClient } from "@supabase/supabase-js";

type Auth = Pick<SupabaseClient["auth"], "getUser" | "getSession" | "mfa">;
export type EstadoMfaLocal = {
  nivel: "aal1" | "aal2" | "desconocido";
  verificados: { id: string }[];
  pendientes: number;
  factoresPendientes: { id: string }[];
  accesoHTTP: number;
};
const mensajes = {
  SIN_SESION: "Inicia sesión con una cuenta de pruebas autorizada en Mi cuenta.",
  SESION_CADUCADA: "La sesión caducó. Vuelve a Mi cuenta y comprueba la sesión antes de continuar con MFA.",
  BLOQUEADO: "Las operaciones MFA requieren autorización explícita y activación local del propietario.",
  CODIGO_INVALIDO: "Introduce los seis dígitos del autenticador; el código no se guarda.",
  CODIGO_RECHAZADO: "El código no es válido o ya caducó. Comprueba la hora automática del autenticador y reintenta con el código actual.",
  DESAFIO_CADUCADO: "El desafío caducó. Reintenta con un código actual; se creará un desafío nuevo, sin enrolar otro factor.",
  LIMITE_INTENTOS: "Se alcanzó el límite de intentos. Espera antes de volver a verificar.",
  TOTP_NO_HABILITADO: "Supabase no permite esta operación TOTP. El propietario debe revisar su configuración; no se desactiva AAL2.",
  QR_NO_DISPONIBLE: "No se pudo presentar el QR. El factor puede haber quedado pendiente; comprueba el estado y no repitas el enrolamiento.",
  FACTOR_NO_ADMITIDO: "Selecciona un factor TOTP propio que siga existiendo. No se modifican factores ajenos.",
  FACTOR_EXISTENTE: "Ya existe un factor. Comprueba el estado y verifica el existente si tienes su código; no se crean duplicados ni se elimina ninguno automáticamente.",
  SESION_CAMBIADA: "La sesión cambió. Vuelve a comprobarla; no se continúa con el factor anterior.",
  OCUPADO: "Espera a que termine la operación actual.",
  NO_DISPONIBLE: "No se pudo completar la operación MFA. No se muestran detalles internos; vuelve a comprobar el estado antes de reintentar.",
  NO_AAL2: "La verificación no ha acreditado AAL2 en la sesión del SDK. El acceso administrativo sigue pendiente.",
} as const;
export class ErrorMfaLocal extends Error {
  codigo: keyof typeof mensajes;
  constructor(codigo: keyof typeof mensajes) { super(mensajes[codigo]); this.codigo = codigo; }
}

/** Solo temporización de la vista, no una prueba de autenticidad ni autorización. */
export function esperaCaducidadSesion(expiresAt: number | undefined, ahora = Date.now()) {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return 0;
  return Math.max(0, Math.min(2147483647, expiresAt * 1000 - ahora));
}

/** Auto-servicio de la identidad actual. No asigna roles ni consulta usuarios administrativos. */
export function crearFlujoMfaLocal(crearAuth: () => Auth, permitirOperaciones = false, solicitar: typeof fetch = fetch) {
  let pendiente: { actorId: string; factorId: string } | null = null;
  let generacion = 0;
  let ocupado = false;
  const fallo = (codigo: keyof typeof mensajes): never => { throw new ErrorMfaLocal(codigo); };
  function errorSeguro(error: unknown): never {
    const e = error as { code?: string; status?: number; name?: string } | null;
    if (e?.code === "mfa_verification_failed") return fallo("CODIGO_RECHAZADO");
    if (e?.code === "mfa_challenge_expired") return fallo("DESAFIO_CADUCADO");
    if (e?.code === "mfa_factor_not_found") return fallo("FACTOR_NO_ADMITIDO");
    if (e?.code === "mfa_factor_name_conflict") return fallo("FACTOR_EXISTENTE");
    if (["mfa_totp_enroll_not_enabled", "mfa_totp_verify_not_enabled"].includes(e?.code ?? "")) return fallo("TOTP_NO_HABILITADO");
    if (e?.status === 429) return fallo("LIMITE_INTENTOS");
    if (e?.status === 401 || e?.status === 403 || e?.name === "AuthSessionMissingError"
      || ["session_not_found", "session_expired", "bad_jwt", "refresh_token_not_found", "refresh_token_already_used"].includes(e?.code ?? "")) return fallo("SIN_SESION");
    return fallo("NO_DISPONIBLE");
  }
  async function proteger<T>(operacion: () => Promise<T>): Promise<T> {
    try { return await operacion(); }
    catch (e) { if (e instanceof ErrorMfaLocal) throw e; return fallo("NO_DISPONIBLE"); }
  }
  async function contexto() {
    const auth = crearAuth();
    const { data, error } = await auth.getUser();
    if (error) return errorSeguro(error);
    if (!data.user || data.user.is_anonymous || !data.user.confirmed_at || data.user.aud !== "authenticated") return fallo("SIN_SESION");
    await sesionVigente(auth, data.user.id);
    return { auth, id: data.user.id };
  }
  async function sesionVigente(auth: Auth, id: string) {
    const { data, error } = await auth.getSession();
    if (error) return errorSeguro(error);
    if (!data.session) return fallo("SIN_SESION");
    if (data.session.user.id !== id) return fallo("SESION_CAMBIADA");
    if (esperaCaducidadSesion(data.session.expires_at) === 0) return fallo("SESION_CADUCADA");
    return data.session;
  }
  async function factores(auth: Auth) {
    const { data, error } = await auth.mfa.listFactors();
    if (error) return errorSeguro(error);
    if (!data || !Array.isArray(data.all)) return fallo("NO_DISPONIBLE");
    return data.all.filter(f => f.factor_type === "totp" && (f.status === "verified" || f.status === "unverified"));
  }
  async function consultarInterno(): Promise<EstadoMfaLocal> {
    const version = generacion;
    const { auth, id } = await contexto();
    const [lista, garantia] = await Promise.all([factores(auth), auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (garantia.error) return errorSeguro(garantia.error);
    if (!garantia.data) return fallo("NO_DISPONIBLE");
    const sesion = await sesionVigente(auth, id);
    const respuesta = await solicitar("/api/administracion/acceso", {
      method: "GET", headers: { Authorization: `Bearer ${sesion.access_token}` },
      credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10000),
    });
    if (respuesta.status === 401) return fallo("SIN_SESION");
    if (respuesta.status === 200 && (await respuesta.json())?.autorizado !== true) return fallo("NO_DISPONIBLE");
    if (version !== generacion) return fallo("SESION_CAMBIADA");
    return {
      nivel: garantia.data.currentLevel === "aal2" ? "aal2" : garantia.data.currentLevel === "aal1" ? "aal1" : "desconocido",
      verificados: lista.filter(f => f.status === "verified").map(f => ({ id: f.id })),
      pendientes: lista.filter(f => f.status === "unverified").length,
      factoresPendientes: lista.filter(f => f.status === "unverified").map(f => ({ id: f.id })),
      accesoHTTP: respuesta.status,
    };
  }
  async function mutacion<T>(acepta: boolean, fn: () => Promise<T>): Promise<T> {
    if (!permitirOperaciones || acepta !== true) return fallo("BLOQUEADO");
    if (ocupado) return fallo("OCUPADO");
    ocupado = true;
    try { return await proteger(fn); } finally { ocupado = false; }
  }
  return {
    limpiar() { pendiente = null; generacion++; },
    consultar: () => proteger(consultarInterno),
    iniciarEnrolamiento: (acepta: boolean) => mutacion(acepta, async () => {
      const version = generacion;
      const { auth, id } = await contexto();
      const lista = await factores(auth);
      if (lista.length || pendiente) return fallo("FACTOR_EXISTENTE");
      if (version !== generacion) return fallo("SESION_CAMBIADA");
      // Solo por acción explícita. enroll CREA un factor remoto no verificado.
      const { data, error } = await auth.mfa.enroll({ factorType: "totp", friendlyName: "DentaIA QA TOTP" });
      if (error) return errorSeguro(error);
      if (!data || data.type !== "totp" || !data.id || !data.totp?.qr_code) return fallo("QR_NO_DISPONIBLE");
      if (version !== generacion) return fallo("SESION_CAMBIADA");
      pendiente = { actorId: id, factorId: data.id };
      let svg = data.totp.qr_code.trim();
      if (svg.startsWith("data:")) {
        const partes = /^data:image\/svg\+xml(?:;(?:utf-8|charset=utf-8|base64))?,([\s\S]+)$/.exec(svg);
        if (!partes) return fallo("QR_NO_DISPONIBLE");
        try { svg = svg.slice(0, svg.indexOf(",")).endsWith(";base64") ? atob(partes[1])
          : partes[1].trim().startsWith("%") ? decodeURIComponent(partes[1]) : partes[1]; }
        catch { return fallo("QR_NO_DISPONIBLE"); }
      }
      // SVGo, usado por Supabase Auth, antepone declaración XML y un comentario.
      // Validar el elemento raíz tras ese prólogo, sin insertar el SVG como HTML.
      const raizSvg = svg.trim().replace(/^<\?xml[^>]*\?>\s*/, "").replace(/^(?:<!--[\s\S]*?-->\s*)+/, "");
      if (!/^<svg\b/.test(raizSvg)) return fallo("QR_NO_DISPONIBLE");
      // No devolver secret, uri, sesión ni objetos Auth. El QR solo vive en memoria de la vista.
      return { factorId: data.id, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
    }),
    verificar: (factorId: string, codigo: string, acepta: boolean) => mutacion(acepta, async () => {
      if (!/^\d{6}$/.test(codigo)) return fallo("CODIGO_INVALIDO");
      const version = generacion;
      const { auth, id } = await contexto();
      const lista = await factores(auth);
      const factor = lista.find(f => f.id === factorId);
      // Permite retomar un pendiente propio ya escaneado tras recargar. La lista es fresca
      // de Auth y el código acredita posesión; nunca se acepta un ID ajeno a esa lista.
      if (!factor || (pendiente?.factorId === factor.id && pendiente.actorId !== id)) return fallo("FACTOR_NO_ADMITIDO");
      if (version !== generacion) return fallo("SESION_CAMBIADA");
      // SDK realiza challenge + verify y conserva su sesión renovada; nunca se falsifica aal.
      const { error } = await auth.mfa.challengeAndVerify({ factorId, code: codigo });
      if (error) return errorSeguro(error);
      if (version !== generacion) return fallo("SESION_CAMBIADA");
      pendiente = null;
      const estado = await consultarInterno();
      if (estado.nivel !== "aal2") return fallo("NO_AAL2");
      return estado; // AAL2 no equivale a superusuario: el HTTP del servidor puede ser 403.
    }),
  };
}
