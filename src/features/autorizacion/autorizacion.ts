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

type ClienteIdentidad = { auth: Pick<SupabaseClient["auth"], "getUser"> };
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
    const { data, error } = await crearCliente().auth.getUser(token);
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
    return { autorizado: true, usuarioId: data.user.id };
  } catch {
    // Error de configuración/red/proveedor: nunca permitir ni filtrar el detalle técnico.
    return { autorizado: false, status: 503 };
  }
}

/** Respuesta mínima: ningún perfil, identificador, token, rol ni dato clínico se serializa. */
export async function responderComprobacionAdministrativa(request: Request, crearCliente: CrearClienteIdentidad): Promise<Response> {
  const resultado = await autorizarSolicitudAdministrativa(request.headers, crearCliente);
  const status = resultado.autorizado ? 200 : resultado.status;
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vary": "Authorization",
  });
  if (status === 401) headers.set("WWW-Authenticate", "Bearer");
  return Response.json(resultado.autorizado ? { autorizado: true } : {
    error: status === 401 ? "Autenticación requerida." : status === 403 ? "Acceso denegado." : "Verificación no disponible.",
  }, { status, headers });
}
