import { ErrorEntrada, clavesExactas, esObjeto, esUuid } from "../clinica-http/validaciones.ts";
import { esEstado, esFdi, faseValida, ubicacionValida, type GuardarOdontograma } from "./modelo.ts";

const invalido = () => new ErrorEntrada(400, "INVALID_REQUEST");

export function entradaOdontograma(body: Record<string, unknown>, id: unknown): GuardarOdontograma {
  const { membershipId, encounterId, record, review } = body;
  if (!clavesExactas(body, ["membershipId", "encounterId", "record", "review"])
    || !esUuid(id) || !esUuid(membershipId) || !esUuid(encounterId)) throw invalido();
  let registro: GuardarOdontograma["record"] = null;
  let revision: GuardarOdontograma["review"] = null;
  if (record !== null) {
    if (!esObjeto(record) || !clavesExactas(record, ["tooth", "surface", "condition", "phase", "note", "replacesId", "correctionReason"])) throw invalido();
    const { tooth, condition, phase, surface, note, replacesId, correctionReason } = record;
    if (!esFdi(tooth) || !esEstado(condition) || !ubicacionValida(tooth, surface, condition) || !faseValida(condition, phase)
      || typeof note !== "string" || note.trim().length > 1000 || (condition === "nota" && !note.trim())
      || (replacesId !== null && !esUuid(replacesId))
      || (replacesId === null ? correctionReason !== null : typeof correctionReason !== "string" || !correctionReason.trim() || correctionReason.trim().length > 300)) throw invalido();
    registro = { tooth, surface: surface as NonNullable<GuardarOdontograma["record"]>["surface"], condition, phase, note: note.trim(),
      replacesId: replacesId?.toLowerCase() ?? null, correctionReason: typeof correctionReason === "string" ? correctionReason.trim() : null };
  }
  if (review !== null) {
    if (!esObjeto(review) || !clavesExactas(review, ["analysisId", "key", "decision"])) throw invalido();
    const { analysisId, key, decision } = review;
    if (!esUuid(analysisId) || typeof key !== "string" || !/^region:[1-9][0-9]{0,8}$/.test(key)
      || (decision !== "accepted" && decision !== "corrected" && decision !== "dismissed")
      || (decision === "dismissed" ? registro !== null : !registro?.note)) throw invalido();
    revision = { analysisId: analysisId.toLowerCase(), key, decision };
  }
  if (!registro && !revision) throw invalido();
  return { id: id.toLowerCase(), membershipId: membershipId.toLowerCase(), encounterId: encounterId.toLowerCase(), record: registro, review: revision };
}
