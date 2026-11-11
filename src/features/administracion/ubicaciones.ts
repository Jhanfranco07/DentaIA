export type OperacionUbicacion =
  | { operacion: "guardar"; dentistId: string; clinicId: string; practiceName: string; practiceAddress: string; latitude: number; longitude: number }
  | { operacion: "publicar"; ubicacionId: string; verificationReference: string }
  | { operacion: "ocultar" | "retirar"; ubicacionId: string };

export class ErrorEntradaUbicacion extends Error {
  readonly status: 400;
  readonly codigo: string;

  constructor(codigo = "ENTRADA_INVALIDA") {
    super(codigo);
    this.status = 400;
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clavesExactas = (v: Record<string, unknown>, permitidas: readonly string[]) => Object.keys(v).length === permitidas.length && Object.keys(v).every(k => permitidas.includes(k));
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Distingue una migración aún no instalada de una caída o denegación de RLS. */
export function tablaUbicacionesAusente(error: unknown): boolean {
  if (!esObjeto(error) || typeof error.code !== "string") return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

export function leerOperacionUbicacion(v: unknown): OperacionUbicacion {
  if (!esObjeto(v) || typeof v.operacion !== "string") throw new ErrorEntradaUbicacion();
  if (v.operacion === "guardar") {
    if (!clavesExactas(v, ["operacion", "dentistId", "clinicId", "practiceName", "practiceAddress", "latitude", "longitude"])
      || !uuid(v.dentistId) || !uuid(v.clinicId)
      || typeof v.practiceName !== "string" || v.practiceName.trim().length < 1 || v.practiceName.trim().length > 160
      || typeof v.practiceAddress !== "string" || v.practiceAddress.trim().length < 1 || v.practiceAddress.trim().length > 300
      || typeof v.latitude !== "number" || !Number.isFinite(v.latitude) || v.latitude < -90 || v.latitude > 90
      || typeof v.longitude !== "number" || !Number.isFinite(v.longitude) || v.longitude < -180 || v.longitude > 180) {
      throw new ErrorEntradaUbicacion();
    }
    return { operacion: "guardar", dentistId: v.dentistId.toLowerCase(), clinicId: v.clinicId.toLowerCase(),
      practiceName: v.practiceName.trim(), practiceAddress: v.practiceAddress.trim(), latitude: v.latitude, longitude: v.longitude };
  }
  if (v.operacion === "publicar") {
    if (!clavesExactas(v, ["operacion", "ubicacionId", "verificationReference"]) || !uuid(v.ubicacionId)
      || typeof v.verificationReference !== "string" || v.verificationReference.trim().length < 8
      || v.verificationReference.trim().length > 500) throw new ErrorEntradaUbicacion();
    return { operacion: "publicar", ubicacionId: v.ubicacionId.toLowerCase(), verificationReference: v.verificationReference.trim() };
  }
  if (v.operacion === "ocultar" || v.operacion === "retirar") {
    if (!clavesExactas(v, ["operacion", "ubicacionId"]) || !uuid(v.ubicacionId)) throw new ErrorEntradaUbicacion();
    return { operacion: v.operacion, ubicacionId: v.ubicacionId.toLowerCase() };
  }
  throw new ErrorEntradaUbicacion();
}

export type ResultadoUbicacion = { ok: true; status: 200; codigo: string; ubicacionId: string }
  | { ok: false; status: 400 | 401 | 403 | 404 | 409; codigo: string };

export function validarResultadoUbicacion(v: unknown): ResultadoUbicacion {
  if (!esObjeto(v) || typeof v.ok !== "boolean" || !Number.isInteger(v.status) || typeof v.codigo !== "string"
    || !/^[A-Z_]{1,60}$/.test(v.codigo)) throw new Error("RESULTADO_NO_CONFIRMADO");
  if (v.ok === true) {
    if (!clavesExactas(v, ["ok", "status", "codigo", "ubicacionId"]) || v.status !== 200 || !uuid(v.ubicacionId)) throw new Error("RESULTADO_NO_CONFIRMADO");
    return { ok: true, status: 200, codigo: v.codigo, ubicacionId: v.ubicacionId.toLowerCase() };
  }
  if (!clavesExactas(v, ["ok", "status", "codigo"]) || ![400, 401, 403, 404, 409].includes(v.status as number)) throw new Error("RESULTADO_NO_CONFIRMADO");
  return { ok: false, status: v.status as 400 | 401 | 403 | 404 | 409, codigo: v.codigo };
}
