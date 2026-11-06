export const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const esUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const clavesExactas = (v: Record<string, unknown>, permitidas: readonly string[]) => Object.keys(v).every(k => permitidas.includes(k));

/** Valida el calendario sin truncar la precisión PostgreSQL de seis decimales. */
export function fechaIso(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!m || !Number.isFinite(Date.parse(v))) return false;
  const [, y, month, day, hour, minute, second] = m;
  return +y >= 1000 && +month >= 1 && +month <= 12 && +day >= 1 && +day <= new Date(Date.UTC(+y, +month, 0)).getUTCDate()
    && +hour < 24 && +minute < 60 && +second < 60;
}

export class ErrorEntrada extends Error {
  status: number; codigo: string;
  constructor(status: number, codigo: string) { super(codigo); this.status = status; this.codigo = codigo; }
}

export async function leerJsonAcotado(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ErrorEntrada(415, "UNSUPPORTED_MEDIA_TYPE");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > 8192)) throw new ErrorEntrada(413, "PAYLOAD_TOO_LARGE");
  if (!request.body) throw new ErrorEntrada(400, "INVALID_REQUEST");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ErrorEntrada(413, "PAYLOAD_TOO_LARGE"); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!esObjeto(value)) throw new ErrorEntrada(400, "INVALID_REQUEST");
    return value;
  } catch (e) { if (e instanceof ErrorEntrada) throw e; throw new ErrorEntrada(400, "INVALID_REQUEST"); }
  finally { reader.releaseLock(); }
}

export function entradaConcesion(v: Record<string, unknown>) {
  if (!clavesExactas(v, ["membershipId", "encounterIds", "expiresAt", "policyVersion", "accepted"]) || !esUuid(v.membershipId)
    || !Array.isArray(v.encounterIds) || v.encounterIds.length < 1 || v.encounterIds.length > 100 || !v.encounterIds.every(esUuid)
    || new Set(v.encounterIds.map(x => x.toLowerCase())).size !== v.encounterIds.length || !fechaIso(v.expiresAt)
    || typeof v.policyVersion !== "string" || v.policyVersion.trim().length < 1 || v.policyVersion.length > 80 || v.accepted !== true) throw new ErrorEntrada(400, "INVALID_REQUEST");
  return { membershipId: v.membershipId, encounterIds: v.encounterIds, expiresAt: v.expiresAt, policyVersion: v.policyVersion, accepted: true };
}

export function consultaHistorial(request: Request) {
  const result: Record<string, string> = {};
  for (const [k, value] of new URL(request.url).searchParams) {
    if (!["membershipId", "cursor", "limit"].includes(k) || Object.hasOwn(result, k)) throw new ErrorEntrada(400, "INVALID_REQUEST");
    result[k] = value;
  }
  const limit = result.limit === undefined ? 20 : Number(result.limit);
  if ((result.limit !== undefined && !/^[1-9]\d?$/.test(result.limit)) || !Number.isInteger(limit) || limit < 1 || limit > 50
    || (result.membershipId !== undefined && !esUuid(result.membershipId)) || (result.cursor !== undefined && (!result.cursor || result.cursor.length > 2048))) throw new ErrorEntrada(400, "INVALID_REQUEST");
  return { membershipId: result.membershipId?.toLowerCase() ?? null, limit, cursor: result.cursor };
}
