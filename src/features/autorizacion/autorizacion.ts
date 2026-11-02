import type { SupabaseClient, User } from "@supabase/supabase-js";

// Roles de negocio, distintos de los roles técnicos anon/authenticated/service_role.
// No constituyen una jerarquía ni habilitan acceso clínico.
export const ROLES_NEGOCIO = ["visitante", "paciente", "odontologo", "superusuario"] as const;
export type RolNegocio = typeof ROLES_NEGOCIO[number];
type RolPersistido = Exclude<RolNegocio, "visitante">;
export type AsignacionAdministrativa = {
  version: 1;
  estado: "activo";
  roles: readonly RolPersistido[];
};

type ClienteIdentidad = { auth: Pick<SupabaseClient["auth"], "getUser" | "getClaims"> };
export type CrearClienteIdentidad = () => ClienteIdentidad;
export type AccesoAdministrativo =
  | { autorizado: true; usuarioId: string }
  | { autorizado: false; status: 401 | 403 | 503 };

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

// Usar exclusivamente con app_metadata obtenido de Auth en el servidor, nunca con JWT decodificado.
export function leerAsignacionAdministrativa(metadata: unknown): AsignacionAdministrativa | null {
  if (!objeto(metadata) || !objeto(metadata.dentaia)) return null;
  const asignacion = metadata.dentaia;
  if (asignacion.version !== 1 || asignacion.estado !== "activo" || !Array.isArray(asignacion.roles)
    || asignacion.roles.length === 0 || !asignacion.roles.every(rol =>
      rol === "paciente" || rol === "odontologo" || rol === "superusuario")) return null;
  return { version: 1, estado: "activo", roles: [...asignacion.roles] };
}

function cuentaHabilitada(usuario: User): boolean {
  if (!usuario.id || usuario.aud !== "authenticated" || usuario.is_anonymous === true
    || usuario.deleted_at || !usuario.confirmed_at) return false;
  if (usuario.banned_until) {
    const hasta = Date.parse(usuario.banned_until);
    if (!Number.isFinite(hasta) || hasta > Date.now()) return false;
  }
  return true;
}

/** Núcleo comprobable. El adaptador server-only suministra el cliente real de Auth. */
export async function autorizarSolicitudAdministrativa(
  headers: Headers, crearCliente: CrearClienteIdentidad,
): Promise<AccesoAdministrativo> {
  const cabecera = headers.get("authorization");
  // No leer token desde URL, body, cookies, IDs, email o roles enviados por el cliente.
  if (!cabecera || cabecera.length > 8192) return { autorizado: false, status: 401 };
  const token = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(cabecera)?.[1];
  if (!token) return { autorizado: false, status: 401 };
  try {
    const cliente = crearCliente();
    const { data, error } = await cliente.auth.getUser(token);
    if (error) {
      // AuthRetryableFetchError puede llegar sin status o con status 0.
      const sesionInvalida = error.status === 400 || error.status === 401 || error.status === 403 || error.status === 422;
      return { autorizado: false, status: sesionInvalida ? 401 : 503 };
    }
    if (!data.user) return { autorizado: false, status: 401 };
    if (!cuentaHabilitada(data.user)) return { autorizado: false, status: 403 };
    // Lectura fresca en cada petición: no usar los claims antiguos del access token.
    const asignacion = leerAsignacionAdministrativa(data.user.app_metadata);
    if (!asignacion?.roles.includes("superusuario")) return { autorizado: false, status: 403 };
    // Solo el SDK verifica firma/caducidad. Nunca interpretar aal desde un JWT sin verificar.
    const verificacion = await cliente.auth.getClaims(token);
    if (verificacion.error) {
      const status = verificacion.error.status;
      return { autorizado: false, status: status === 400 || status === 401 || status === 403 || status === 422 ? 401 : 503 };
    }
    const claims = verificacion.data?.claims;
    if (!claims || claims.sub !== data.user.id || claims.role !== "authenticated"
      || typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000
      || typeof claims.session_id !== "string" || !claims.session_id) return { autorizado: false, status: 401 };
    if (claims.aal !== "aal2" || !data.user.factors?.some(factor => factor.status === "verified")) {
      return { autorizado: false, status: 403 };
    }
    return { autorizado: true, usuarioId: data.user.id };
  } catch {
    // Error de configuración/red/proveedor: nunca permitir ni filtrar el detalle técnico.
    return { autorizado: false, status: 503 };
  }
}

// Lista deliberadamente cerrada. DI-151/DI-152 deberán añadir permisos específicos revisados.
export const ACCIONES_ADMINISTRATIVAS = ["comprobar_acceso"] as const;
export type AccionAdministrativa = typeof ACCIONES_ADMINISTRATIVAS[number];
export type ContextoAdministrativo = Readonly<{ usuarioId: string; accion: AccionAdministrativa }>;
export type OperacionAdministrativa = (contexto: ContextoAdministrativo) => Promise<Response> | Response;

function respuestaPrivada(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Vary", [...new Set([...(headers.get("Vary") ?? "").split(",").map(v => v.trim()).filter(Boolean), "Authorization"])].join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function respuestaDenegada(status: 401 | 403 | 500 | 503): Response {
  const headers = new Headers();
  if (status === 401) headers.set("WWW-Authenticate", "Bearer");
  return respuestaPrivada(Response.json({
    error: status === 401 ? "Autenticación requerida." : status === 403 ? "Acceso denegado." : "Verificación no disponible.",
  }, { status, headers }));
}

/** Ejecuta el servicio y construye su respuesta solo DESPUÉS de autorizar, por petición. */
export async function ejecutarOperacionAdministrativa(
  request: Request, accion: AccionAdministrativa, crearCliente: CrearClienteIdentidad, operacion: OperacionAdministrativa,
): Promise<Response> {
  const acceso = await autorizarSolicitudAdministrativa(request.headers, crearCliente);
  if (!acceso.autorizado) return respuestaDenegada(acceso.status);
  if (!ACCIONES_ADMINISTRATIVAS.includes(accion)) return respuestaDenegada(403);
  try {
    // Nunca aceptar el contexto desde el cuerpo, la URL o una autorización anterior.
    return respuestaPrivada(await operacion(Object.freeze({ usuarioId: acceso.usuarioId, accion })));
  } catch {
    return respuestaDenegada(500);
  }
}

/** Respuesta mínima: ningún perfil, identificador, token, rol ni dato clínico se serializa. */
export function responderComprobacionAdministrativa(request: Request, crearCliente: CrearClienteIdentidad): Promise<Response> {
  return ejecutarOperacionAdministrativa(request, "comprobar_acceso", crearCliente,
    () => Response.json({ autorizado: true }));
}
