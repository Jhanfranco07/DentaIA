import { esObjeto, esUuid, fechaIso } from "../clinica-http/validaciones.ts";
import { esEstado, esFdi, faseValida, ubicacionValida, type ExpedienteOdontograma, type Registro, type Revision } from "./modelo.ts";
import { observacionesSmile } from "./observaciones.ts";

const dtoInvalido = () => new Error("INVALID_ODONTOGRAM_DTO");
const textoOpcional = (v: unknown): v is string | null => v === null || typeof v === "string";

export function expedienteDto(raw: unknown, patientId: string): ExpedienteOdontograma {
  if (!esObjeto(raw) || raw.patientId !== patientId || !textoOpcional(raw.patientName)
    || !Array.isArray(raw.encounters) || !Array.isArray(raw.records) || !Array.isArray(raw.reviews) || !Array.isArray(raw.analyses)) throw dtoInvalido();
  const encounters = raw.encounters.map((e: unknown) => {
    if (!esObjeto(e) || !esUuid(e.id) || !fechaIso(e.date) || typeof e.editable !== "boolean") throw dtoInvalido();
    return { id: e.id, date: e.date, editable: e.editable };
  });
  const known = new Set(encounters.map(e => e.id));
  const records: Registro[] = raw.records.map((r: unknown) => {
    if (!esObjeto(r) || !esUuid(r.id) || !esUuid(r.encounterId) || !known.has(r.encounterId) || !esFdi(r.tooth)
      || !esEstado(r.condition) || !ubicacionValida(r.tooth, r.surface, r.condition) || !faseValida(r.condition, r.phase)
      || typeof r.note !== "string" || (r.replacesId !== null && !esUuid(r.replacesId))
      || !textoOpcional(r.correctionReason) || !textoOpcional(r.author) || !fechaIso(r.recordedAt)
      || typeof r.active !== "boolean") throw dtoInvalido();
    return {
      id: r.id, encounterId: r.encounterId, tooth: r.tooth, surface: r.surface as Registro["surface"],
      condition: r.condition, phase: r.phase, note: r.note, replacesId: r.replacesId,
      correctionReason: r.correctionReason, author: r.author, recordedAt: r.recordedAt, active: r.active,
    };
  });
  const photos: string[] = [];
  const observations = raw.analyses.flatMap((a: unknown) => {
    if (!esObjeto(a) || !esUuid(a.id) || !fechaIso(a.date) || typeof a.version !== "string") throw dtoInvalido();
    if (typeof a.path === "string") photos.push(a.id);
    return observacionesSmile({ id: a.id, date: a.date, version: a.version, result: a.result });
  });
  const reviews: Revision[] = raw.reviews.map((r: unknown) => {
    if (!esObjeto(r) || !esUuid(r.analysisId) || typeof r.key !== "string" || !fechaIso(r.recordedAt)
      || (r.entryId !== null && !esUuid(r.entryId))
      || (r.decision !== "accepted" && r.decision !== "corrected" && r.decision !== "dismissed")) throw dtoInvalido();
    return { analysisId: r.analysisId, key: r.key, entryId: r.entryId, decision: r.decision, recordedAt: r.recordedAt };
  });
  return { patientId, patientName: raw.patientName, encounters, records, observations, reviews, availablePhotos: photos };
}
