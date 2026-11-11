import { esObjeto, esUuid, fechaIso } from "./validaciones";

const objeto = (v: unknown) => { if (!esObjeto(v)) throw new Error("INVALID_RPC_DTO"); return v; };
const uuid = (v: unknown, nullable = false) => { if (nullable && v === null) return null; if (!esUuid(v)) throw new Error("INVALID_RPC_DTO"); return v; };
const text = (v: unknown, max: number, nullable = false) => { if (nullable && v === null) return null; if (typeof v !== "string" || v.length > max) throw new Error("INVALID_RPC_DTO"); return v; };
const date = (v: unknown) => { if (!fechaIso(v)) throw new Error("INVALID_RPC_DTO"); return v; };
const list = (v: unknown, max = 100) => { if (!Array.isArray(v) || v.length > max) throw new Error("INVALID_RPC_DTO"); return v; };
function state(v: unknown) { if (!["recorded", "unknown", "not_recorded"].includes(String(v))) throw new Error("INVALID_RPC_DTO"); return v as string; }
function entry(v: unknown) {
  const a = objeto(v);
  return { id: uuid(a.id), state: state(a.state), value: text(a.value, 10000, true), codeSystem: text(a.codeSystem, 500, true), code: text(a.code, 500, true) };
}

/** Proyección explícita: no reenvía objetos RPC completos ni campos nuevos por accidente. */
export function historialDto(raw: Record<string, unknown>, patientId: string) {
  if (raw.apiVersion !== "clinical.v1" || raw.origen !== "supabase" || raw.environment !== "qa_local" || !["listo", "sin_datos"].includes(String(raw.estado))) throw new Error("INVALID_RPC_DTO");
  const c = objeto(raw.caso);
  if (uuid(c.patientId)?.toLowerCase() !== patientId.toLowerCase()) throw new Error("INVALID_RPC_DTO");
  const context = { professional: uuid(c.professionalContext, true), clinic: uuid(c.clinicContext, true) };
  const entries = list(raw.entries, 50).map(v => {
    const e = objeto(v), o = objeto(e.origin), b = objeto(e.background);
    if (!["recorded", "voided"].includes(String(e.status))) throw new Error("INVALID_RPC_DTO");
    return {
      encounterId: uuid(e.encounterId), attendedAt: date(e.attendedAt), recordedAt: date(e.recordedAt), status: e.status,
      replacesId: uuid(e.replacesId, true), correctionReason: text(e.correctionReason, 1000, true),
      origin: { clinicId: uuid(o.clinicId), clinicName: text(o.clinicName, 200), professionalId: uuid(o.professionalId), professionalName: text(o.professionalName, 120, true) },
      background: { state: state(b.state), value: text(b.value, 10000, true), ...(b.entryId === undefined ? {} : { entryId: uuid(b.entryId) }) },
      clinicalEntries: list(e.clinicalEntries).map(v => {
        const a = objeto(v); if (!["background", "diagnosis", "treatment"].includes(String(a.kind))) throw new Error("INVALID_RPC_DTO");
        return { ...entry(a), kind: a.kind, recordedAt: date(a.recordedAt), replacesId: uuid(a.replacesId, true), correctionReason: text(a.correctionReason, 1000, true) };
      }),
      diagnoses: list(e.diagnoses).map(entry), treatments: list(e.treatments).map(entry),
      exams: list(e.exams).map(v => {
        const d = objeto(v);
        if (!["exam", "document"].includes(String(d.kind)) || !["available", "unavailable"].includes(String(d.availability))
          || !(d.examDate === null || (typeof d.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.examDate)))) throw new Error("INVALID_RPC_DTO");
        return { id: uuid(d.id), kind: d.kind, title: text(d.title, 200), examDate: d.examDate, availability: d.availability };
      }),
    };
  });
  let position: { beforeAt: string; beforeId: string } | null = null;
  if (raw.nextCursor !== null) {
    const n = objeto(raw.nextCursor); position = { beforeAt: date(n.beforeAt), beforeId: uuid(n.beforeId)! };
  }
  return { context, position, data: { apiVersion: "clinical.v1", origen: "supabase", environment: "qa_local", estado: raw.estado,
    caso: { patientId, professionalContext: context.professional, clinicContext: context.clinic }, entries } };
}

export function concesionDto(raw: Record<string, unknown>, id: string) {
  if (uuid(raw.id)?.toLowerCase() !== id.toLowerCase() || !["vigente", "vencido", "revocado"].includes(String(raw.estado)) || typeof raw.replayed !== "boolean") throw new Error("INVALID_RPC_DTO");
  return { id, estado: raw.estado, expiresAt: date(raw.expiresAt), revokedAt: raw.revokedAt === null ? null : date(raw.revokedAt), replayed: raw.replayed };
}
export function revocacionDto(raw: Record<string, unknown>, id: string) {
  if (uuid(raw.id)?.toLowerCase() !== id.toLowerCase()) throw new Error("INVALID_RPC_DTO");
  return { id, revokedAt: date(raw.revokedAt) };
}
