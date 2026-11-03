import { ErrorEntrada, esObjeto, esUuid, fechaIso } from "./validaciones";

export type TipoWorkspace = "patient" | "professional" | "grants" | "patients" | "requests";
export function consultaWorkspace(request: Request, kind: TipoWorkspace) {
  const q: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!["membershipId", "afterId", "limit", "status"].includes(key) || Object.hasOwn(q, key)) throw new ErrorEntrada(400, "INVALID_REQUEST");
    q[key] = value;
  }
  const limit = q.limit === undefined ? 20 : Number(q.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (q.limit !== undefined && !/^[1-9]\d?$/.test(q.limit))
    || (q.afterId !== undefined && !esUuid(q.afterId)) || (q.membershipId !== undefined && !esUuid(q.membershipId))
    || (["patients", "requests"].includes(kind) ? !q.membershipId : q.membershipId !== undefined)
    || (kind === "patient" && q.afterId !== undefined)
    || (q.status !== undefined && (kind !== "requests" || !["requested", "cancelled"].includes(q.status)))) throw new ErrorEntrada(400, "INVALID_REQUEST");
  return { p_kind: kind, p_membership_id: q.membershipId?.toLowerCase() ?? null, p_after_id: q.afterId?.toLowerCase() ?? null, p_limit: limit, p_status: q.status ?? null };
}

// Solo whitelist: ni un nuevo atributo SQL se publica automáticamente.
export function workspaceDto(raw: Record<string, unknown>, kind: TipoWorkspace) {
  const invalid = (): never => { throw new Error("INVALID_WORKSPACE_DTO"); };
  const object = (v: unknown) => esObjeto(v) ? v : invalid();
  const uuid = (v: unknown): string => esUuid(v) ? v : invalid();
  const nullableUuid = (v: unknown) => v === null ? null : uuid(v);
  const date = (v: unknown) => fechaIso(v) ? v : invalid();
  const nullableDate = (v: unknown) => v === null ? null : date(v);
  const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max ? v : invalid();
  const array = (v: unknown, max = 50) => Array.isArray(v) && v.length <= max ? v : invalid();
  if (raw.kind !== kind || raw.apiVersion !== "clinical.workspace.v1" || raw.environment !== "qa_local") invalid();
  const d = object(raw.data);
  let data: Record<string, unknown>;
  if (kind === "patient") data = { patientId: uuid(d.patientId) };
  else if (kind === "professional") data = { professionalId: uuid(d.professionalId), dentistId: nullableUuid(d.dentistId), contexts: array(d.contexts).map(v => {
    const c = object(v); return { membershipId: uuid(c.membershipId), clinicId: uuid(c.clinicId), clinicName: text(c.clinicName, 200), validFrom: date(c.validFrom), validUntil: nullableDate(c.validUntil) };
  }) };
  else if (kind === "grants") data = { patientId: uuid(d.patientId), items: array(d.items).map(v => {
    const g = object(v); if (!["vigente", "vencido", "revocado"].includes(String(g.estado))) invalid();
    return { id: uuid(g.id), membershipId: uuid(g.membershipId), estado: g.estado, expiresAt: date(g.expiresAt), revokedAt: nullableDate(g.revokedAt), policyVersion: text(g.policyVersion, 80), encounterIds: array(g.encounterIds, 100).map(uuid) };
  }) };
  else if (kind === "patients") data = { membershipId: uuid(d.membershipId), items: array(d.items).map(v => ({ patientId: uuid(object(v).patientId) })) };
  else data = { membershipId: uuid(d.membershipId), professionalId: uuid(d.professionalId), items: array(d.items).map(v => {
    const a = object(v);
    if (!["requested", "cancelled"].includes(String(a.status)) || a.isDemo !== true || typeof a.preferredDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(a.preferredDate)
      || !(a.preferredTime === null || (typeof a.preferredTime === "string" && /^\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(a.preferredTime)))) invalid();
    return { id: uuid(a.id), status: a.status, createdAt: date(a.createdAt), preferredDate: a.preferredDate, preferredTime: a.preferredTime, isDemo: true };
  }) };
  return { apiVersion: "clinical.workspace.v1", environment: "qa_local", kind, data, nextAfterId: nullableUuid(raw.nextAfterId) };
}
