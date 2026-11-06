import type { AccionAdministrativa, OperacionAdministrativa } from "../autorizacion/autorizacion";

export type AsignacionRoles = { version: 1; estado: "activo"; roles: ("paciente" | "odontologo" | "superusuario")[] };
export type CambioRoles = { usuarioId: string; operacion: "asignar" | "revocar"; rol: "paciente" | "odontologo" | "superusuario";
  revisionEsperada: number; asignacionEsperada: AsignacionRoles | null; aprobacionId: string };
export type SesionEscritura = { actorId: string; sesionId: string; expira: number };
export type RespuestaRoles = { status: 200 | 400 | 403 | 404 | 409 | 503; codigo: string;
  resultado: "consultado" | "aplicado" | "sin_cambios" | "rechazado"; revision: number | null; asignacion: AsignacionRoles | null };
export type ProveedorCambiosRoles = { ejecutar(sesion: SesionEscritura, peticion: CambioRoles | { usuarioId: string; operacion: "consultar" }, solicitudId: string | null): Promise<RespuestaRoles> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const uuidRolesValido = (v: unknown): v is string => typeof v === "string" && uuid.test(v);
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const exacto = (v: Record<string, unknown>, claves: string[]) => Object.keys(v).length === claves.length && claves.every(k => Object.hasOwn(v, k));
export function asignacionRolesValida(v: unknown): v is AsignacionRoles {
  return objeto(v) && exacto(v, ["version", "estado", "roles"]) && v.version === 1 && v.estado === "activo"
    && Array.isArray(v.roles) && v.roles.length > 0 && v.roles.length <= 3 && new Set(v.roles).size === v.roles.length
    && v.roles.every(r => ["paciente", "odontologo", "superusuario"].includes(r));
}
export function validarCambioRoles(v: unknown): CambioRoles | null {
  if (!objeto(v) || !exacto(v, ["usuarioId", "operacion", "rol", "revisionEsperada", "asignacionEsperada", "aprobacionId"])
    || !uuidRolesValido(v.usuarioId) || !uuidRolesValido(v.aprobacionId) || !["asignar", "revocar"].includes(String(v.operacion))
    || !["paciente", "odontologo", "superusuario"].includes(String(v.rol)) || typeof v.revisionEsperada !== "number"
    || !Number.isSafeInteger(v.revisionEsperada) || v.revisionEsperada < 0 || v.revisionEsperada >= 2147483647
    || (v.asignacionEsperada !== null && !asignacionRolesValida(v.asignacionEsperada))) return null;
  return { usuarioId: v.usuarioId.toLowerCase(), operacion: v.operacion as CambioRoles["operacion"], rol: v.rol as CambioRoles["rol"],
    revisionEsperada: v.revisionEsperada, asignacionEsperada: v.asignacionEsperada as AsignacionRoles | null, aprobacionId: v.aprobacionId.toLowerCase() };
}

/** Especificación de restricciones, no una autorización. SQL obtiene el control
 * de la aprobación privada y de Auth bajo bloqueo; el API no admite esos booleanos. */
export function evaluarTransicionRoles(actorId: string, objetivoId: string, actual: AsignacionRoles | null, cambio: Pick<CambioRoles, "operacion" | "rol">,
  control: { aprobacionIndependiente: boolean; superusuariosActivos: number; mfaObjetivo: boolean } = { aprobacionIndependiente: false, superusuariosActivos: 0, mfaObjetivo: false }) {
  if (actorId.toLowerCase() === objetivoId.toLowerCase()) return { permitido: false as const, codigo: "CAMBIO_PROPIO_PROHIBIDO" };
  if (actual?.roles.includes("superusuario") && !control.aprobacionIndependiente) return { permitido: false as const, codigo: "SUPERUSUARIO_PROTEGIDO" };
  if (cambio.rol !== "paciente" && !control.aprobacionIndependiente) return { permitido: false as const, codigo: "APROBACION_ESPECIAL_REQUERIDA" };
  if (cambio.rol === "superusuario" && cambio.operacion === "revocar" && actual?.roles.includes("superusuario") && control.superusuariosActivos <= 1) {
    return { permitido: false as const, codigo: "ULTIMO_SUPERUSUARIO_PROTEGIDO" };
  }
  if (cambio.rol === "superusuario" && cambio.operacion === "asignar" && !control.mfaObjetivo) return { permitido: false as const, codigo: "MFA_OBJETIVO_REQUERIDO" };
  if (cambio.rol === "odontologo" && cambio.operacion === "asignar") return { permitido: false as const, codigo: "VERIFICACION_PROFESIONAL_PENDIENTE" };
  const roles = new Set(actual?.roles ?? []);
  if (cambio.operacion === "asignar") roles.add(cambio.rol); else roles.delete(cambio.rol);
  const siguientes = [...roles].sort() as AsignacionRoles["roles"];
  return { permitido: true as const, asignacion: siguientes.length ? { version: 1 as const, estado: "activo" as const, roles: siguientes } : null };
}

type EjecutarGuard = (r: Request, a: AccionAdministrativa, o: OperacionAdministrativa) => Promise<Response>;
type ObtenerSesion = (r: Request, actorId: string) => Promise<SesionEscritura | null>;
/** DI-150 se aplica antes de leer cuerpo o crear un cliente privilegiado. */
export function crearApiCambiosRoles(guard: EjecutarGuard, sesion: ObtenerSesion, proveedor: ProveedorCambiosRoles) {
  return (request: Request) => guard(request, "roles.actualizar", async contexto => {
    const error = (status: number, codigo: string) => Response.json({ codigo }, { status });
    if (!["GET", "POST"].includes(request.method)) return error(405, "METODO_NO_ADMITIDO");
    const url = new URL(request.url);
    let peticion: CambioRoles | { usuarioId: string; operacion: "consultar" };
    let solicitudId: string | null = null;
    if (request.method === "GET") {
      const keys = [...url.searchParams.keys()];
      const usuarioId = url.searchParams.get("usuarioId");
      if (keys.length !== 1 || keys[0] !== "usuarioId" || !uuidRolesValido(usuarioId)) return error(400, "CONSULTA_INVALIDA");
      peticion = { usuarioId: usuarioId.toLowerCase(), operacion: "consultar" };
    } else {
      if (url.search || request.headers.get("origin") !== url.origin
        || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return error(403, "ORIGEN_NO_ADMITIDO");
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return error(400, "JSON_REQUERIDO");
      const key = request.headers.get("idempotency-key");
      if (!uuidRolesValido(key)) return error(400, "IDEMPOTENCIA_REQUERIDA");
      solicitudId = key.toLowerCase();
      const reader = request.body?.getReader();
      if (!reader) return error(400, "CUERPO_REQUERIDO");
      const partes: Uint8Array[] = []; let longitud = 0;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        longitud += value.byteLength;
        if (longitud > 2048) { await reader.cancel(); return error(413, "CUERPO_EXCESIVO"); }
        partes.push(value);
      }
      const bytes = new Uint8Array(longitud); let offset = 0;
      for (const parte of partes) { bytes.set(parte, offset); offset += parte.length; }
      let entrada: unknown;
      try { entrada = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return error(400, "JSON_INVALIDO"); }
      const cambio = validarCambioRoles(entrada);
      if (!cambio) return error(400, "CAMBIO_INVALIDO");
      peticion = cambio;
    }
    const identidad = await sesion(request, contexto.usuarioId);
    if (!identidad || identidad.actorId !== contexto.usuarioId) return error(403, "SESION_ESCRITURA_NO_VALIDA");
    try {
      const r = await proveedor.ejecutar(identidad, peticion, solicitudId);
      // El adaptador valida el contrato; la API proyecta explícitamente sin datos Auth.
      return Response.json({ codigo: r.codigo, resultado: r.resultado, revision: r.revision, asignacion: r.asignacion, solicitudId }, { status: r.status });
    } catch {
      // Puede haberse confirmado el commit aunque se pierda la respuesta. No prometer rollback.
      return Response.json({ codigo: "ESTADO_NO_CONFIRMADO", solicitudId,
        instruccion: "Reintentar el mismo contenido con la misma clave; no generar otra solicitud." }, { status: 503 });
    }
  });
}
