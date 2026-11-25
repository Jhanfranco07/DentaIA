
import "server-only";

import { createHash, createHmac } from "node:crypto";
import { createUserScopedSupabaseClient } from "@/lib/supabase/request.server";
import { getAccessTokenFromRequest } from "@/lib/supabase/server-auth";
import { esUuid } from "@/features/clinica-http/validaciones";
import { assertPremiumVisionResult } from "./contract";
import { authorizePremiumVisionRequest, type VerifyPremiumVisionProcessingConsent } from "./server";
import type { CaptureProtocol, HistoryEvaluation } from "./history";

type PersistEvaluation = {
  id: string;
  evaluatedAt: Date;
  resultConsentId: string;
  result: unknown;
  captureProtocol: CaptureProtocol | null;
  photo?: { id: string; consentId: string; evaluatedBytes: Uint8Array };
};

/**
 * Integration point for DI-211 after provider validation. There is no HTTP
 * ingestion route and the current inference capability denies this operation.
 */
export async function persistPremiumVisionResult(
  request: Request,
  verifyTemporaryConsent: VerifyPremiumVisionProcessingConsent,
  evaluation: PersistEvaluation,
) {
  const authorization = await authorizePremiumVisionRequest(request, verifyTemporaryConsent);
  if (!authorization.allowed) return authorization;
  const token = getAccessTokenFromRequest(request);
  const secret = process.env.DENTAIA_PREMIUM_INGEST_HMAC_HEX;
  if (!token || !secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error("PREMIUM_INGEST_UNAVAILABLE");
  const { id, resultConsentId, result, photo, evaluatedAt, captureProtocol } = evaluation;
  if (!esUuid(id) || !esUuid(resultConsentId)
    || (captureProtocol !== null && captureProtocol !== "frontal_intraoral_v1")) throw new Error("INVALID_PREMIUM_EVALUATION");
  assertPremiumVisionResult(result);
  const client = createUserScopedSupabaseClient(token);

  let photoObjectId: string | null = null;
  let photoDigest: string | null = null;
  if (photo) {
    if (!esUuid(photo.id) || !esUuid(photo.consentId) || !photo.evaluatedBytes.length || photo.evaluatedBytes.length > 8 * 1024 * 1024) {
      throw new Error("INVALID_PREMIUM_PHOTO");
    }
    const row = await client.from("dental_photos").select("object_path,mime_type,size_bytes")
      .eq("id", photo.id).eq("user_id", authorization.userId).maybeSingle();
    if (row.error || !row.data || row.data.size_bytes !== photo.evaluatedBytes.length) throw new Error("PREMIUM_PHOTO_UNAVAILABLE");
    const bucket = client.storage.from("dental-photos");
    const info = await bucket.info(row.data.object_path);
    if (info.error || !esUuid(info.data.id)) throw new Error("PREMIUM_PHOTO_UNAVAILABLE");
    const original = await bucket.download(row.data.object_path);
    const current = await bucket.info(row.data.object_path);
    if (current.error || current.data.id !== info.data.id || current.data.version !== info.data.version) {
      throw new Error("PREMIUM_PHOTO_UNAVAILABLE");
    }
    const expected = createHash("sha256").update(photo.evaluatedBytes).digest();
    if (original.error || original.data.type !== row.data.mime_type || original.data.size !== row.data.size_bytes
      || !createHash("sha256").update(Buffer.from(await original.data.arrayBuffer())).digest()
        .equals(expected)) {
      throw new Error("PREMIUM_PHOTO_UNAVAILABLE");
    }
    photoObjectId = info.data.id;
    photoDigest = expected.toString("hex");
  }
  const payload = JSON.stringify({
    userId: authorization.userId, id: id.toLowerCase(), issuedAt: new Date().toISOString(),
    evaluatedAt: evaluatedAt.toISOString(), resultConsentId, result, captureProtocol,
    photoId: photo?.id ?? null, photoConsentId: photo?.consentId ?? null, photoObjectId, photoDigest,
  });
  if (Buffer.byteLength(payload, "utf8") > 132000) throw new Error("INVALID_PREMIUM_EVALUATION");
  const signature = createHmac("sha256", Buffer.from(secret,"hex")).update(payload,"utf8").digest("hex");
  const stored = await client.rpc("access_premium_history", {
    p_action: "save", p_evaluation: id.toLowerCase(), p_args: { payload, signature },
  });
  const data = stored.data;
  if (stored.error || !data || Array.isArray(data) || typeof data !== "object" || data.ok !== true) {
    throw new Error("PREMIUM_INGEST_REJECTED");
  }
  return { allowed: true, id: id.toLowerCase() } as const;
}

/** DI-42 can consume this projection from an already authorized history item. */
export function premiumPreventiveReportSource(item: HistoryEvaluation) {
  return { evaluatedAt: item.date, result: item.result, captureProtocol: item.captureProtocol };
}
