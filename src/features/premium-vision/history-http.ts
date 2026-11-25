
import { esUuid, fechaIso, leerJsonAcotado, ErrorEntrada, esObjeto, clavesExactas } from "../clinica-http/validaciones.ts";
import { HISTORY_PURPOSES, HISTORY_CONSENT_VERSION } from "./history.ts";

const invalid = () => { throw new ErrorEntrada(400, "INVALID_REQUEST"); };

export async function historyQuery(request: Request, professional: boolean) {
  if (new URL(request.url).search) invalid();
  const body = await leerJsonAcotado(request);
  const allowed = professional ? ["patientId","membershipId","afterId","before","photo"] : ["afterId","before","photo"];
  if (!clavesExactas(body,allowed)) invalid();
  const { patientId, membershipId, afterId, before, photo } = body;
  if (professional && (!esUuid(patientId) || !esUuid(membershipId))) invalid();
  if ((photo !== undefined && (!esUuid(photo) || afterId !== undefined || before !== undefined))
    || ((before !== undefined || afterId !== undefined) && (!fechaIso(before) || !esUuid(afterId)))) invalid();
  const evaluation = photo ?? afterId;
  return {
    action: photo ? "photo" : "list",
    patient: esUuid(patientId) ? patientId.toLowerCase() : null,
    membership: esUuid(membershipId) ? membershipId.toLowerCase() : null,
    evaluation: esUuid(evaluation) ? evaluation.toLowerCase() : null,
    args: before ? { before } : {},
  };
}

export async function historyCommand(request: Request) {
  if (new URL(request.url).search) invalid();
  const body = await leerJsonAcotado(request);
  const { action, purpose, version, accepted, evaluationId, grantId, photo } = body;
  if (action === "consent_accept" || action === "consent_revoke") {
    const accepting = action === "consent_accept";
    if (!clavesExactas(body, accepting ? ["action","purpose","version","accepted"] : ["action","purpose"])
      || !HISTORY_PURPOSES.some(value => value === purpose)
      || (accepting && (version !== HISTORY_CONSENT_VERSION || accepted !== true))) invalid();
    return { action, evaluation: null, grant: null, args: accepting ? {purpose,version,accepted} : {purpose} };
  }
  if ((action !== "share" && action !== "unshare" && action !== "delete") || !esUuid(evaluationId)) return invalid();
  if (action === "delete") {
    if (!clavesExactas(body,["action","evaluationId"])) invalid();
    return { action, evaluation: evaluationId.toLowerCase(), grant: null, args: {} };
  }
  if (!esUuid(grantId)) return invalid();
  if (action === "share") {
    if (!clavesExactas(body,["action","evaluationId","grantId","accepted","photo"]) || accepted !== true || typeof photo !== "boolean") invalid();
  } else if (!clavesExactas(body,["action","evaluationId","grantId"])) invalid();
  return { action, evaluation: evaluationId.toLowerCase(), grant: grantId.toLowerCase(), args: action === "share" ? {accepted,photo} : {} };
}

export function historyPhoto(value: unknown) {
  if (!esObjeto(value) || typeof value.path !== "string"
    || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-zA-Z0-9_.-]+$/.test(value.path)
    || [".",".."].includes(value.path.split("/")[2])
    || (value.mime !== "image/jpeg" && value.mime !== "image/png" && value.mime !== "image/webp")
    || typeof value.digest !== "string" || !/^[a-f0-9]{64}$/.test(value.digest)
    || typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > 8 * 1024 * 1024) {
    throw new Error("INVALID_PREMIUM_PHOTO");
  }
  return { path: value.path, mime: value.mime, size: value.size, digest: value.digest };
}
