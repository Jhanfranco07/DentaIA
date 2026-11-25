import type { Plan } from "@/features/planes/catalogo";
import type { VisionAccess } from "@/features/autorizacion/vision-demo";

export const PREMIUM_VISION_FEATURE = "premium_visual_evaluation" as const;

export type PremiumVisionProcessingConsent =
  | { granted: true; scope: "temporary_premium_evaluation"; version: string; source: "request_acknowledgement" | "persisted_record"; consentId: string | null }
  | { granted: false; reason: "missing" | "revoked" | "invalid" };

export type PremiumVisionAuthorization =
  | { allowed: true; userId: string; consent: Extract<PremiumVisionProcessingConsent, { granted: true }> }
  | { allowed: false; status: 401 | 403 | 503; code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "AUTH_UNAVAILABLE" | "PREMIUM_REQUIRED" | "FEATURE_NOT_ENABLED" | "PROCESSING_CONSENT_REQUIRED" | "CONSENT_UNAVAILABLE" };

export type PremiumVisionAuthorizationInput = {
  identity: VisionAccess;
  plan: Plan | null;
  featureEnabled: boolean;
  consent: PremiumVisionProcessingConsent | null;
  dependencyUnavailable?: "plan" | "consent";
};

function validConsent(consent: PremiumVisionProcessingConsent | null): consent is Extract<PremiumVisionProcessingConsent, { granted: true }> {
  if (consent?.granted !== true
    || consent.scope !== "temporary_premium_evaluation"
    || consent.version.trim().length === 0 || consent.version.length > 80) return false;
  const persisted = consent.source === "persisted_record";
  return persisted
    ? typeof consent.consentId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(consent.consentId)
    : consent.source === "request_acknowledgement" && consent.consentId === null;
}

/** Pure policy. Plan and consent must have been resolved by trusted server dependencies. */
export function decidePremiumVisionAuthorization(input: PremiumVisionAuthorizationInput): PremiumVisionAuthorization {
  if (!input.identity.allowed) return input.identity;
  if (input.dependencyUnavailable === "plan") return { allowed: false, status: 503, code: "AUTH_UNAVAILABLE" };
  if (input.plan !== "premium") return { allowed: false, status: 403, code: "PREMIUM_REQUIRED" };
  if (!input.featureEnabled) return { allowed: false, status: 503, code: "FEATURE_NOT_ENABLED" };
  if (input.dependencyUnavailable === "consent") return { allowed: false, status: 503, code: "CONSENT_UNAVAILABLE" };
  if (!validConsent(input.consent)) return { allowed: false, status: 403, code: "PROCESSING_CONSENT_REQUIRED" };
  return { allowed: true, userId: input.identity.userId, consent: input.consent };
}
