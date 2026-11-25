import "server-only";

import { authorizeVisionDemoRequest } from "@/features/autorizacion/vision-demo-server";
import { featureEnabled } from "@/features/planes/catalogo";
import { readEffectivePlan } from "@/features/planes/premium-server";
import { getAccessTokenFromRequest } from "@/lib/supabase/server-auth";
import {
  decidePremiumVisionAuthorization,
  PREMIUM_VISION_FEATURE,
  type PremiumVisionAuthorization,
  type PremiumVisionProcessingConsent,
} from "./authorization";

export type VerifyPremiumVisionProcessingConsent = (context: {
  request: Request;
  userId: string;
  accessToken: string;
}) => Promise<PremiumVisionProcessingConsent>;

/**
 * Composes the existing verified identity and server-side subscription lookup.
 * A future route must call this before parsing or forwarding image bytes.
 */
export async function authorizePremiumVisionRequest(
  request: Request,
  verifyConsent: VerifyPremiumVisionProcessingConsent,
): Promise<PremiumVisionAuthorization> {
  const identity = await authorizeVisionDemoRequest(request.headers);
  if (!identity.allowed) return identity;

  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) return { allowed: false, status: 401, code: "AUTH_REQUIRED" };

  let plan;
  try {
    plan = await readEffectivePlan(accessToken);
  } catch {
    return decidePremiumVisionAuthorization({ identity, plan: null, featureEnabled: false, consent: null, dependencyUnavailable: "plan" });
  }

  const enabled = featureEnabled(plan, PREMIUM_VISION_FEATURE);
  if (!enabled) return decidePremiumVisionAuthorization({ identity, plan, featureEnabled: false, consent: null });

  try {
    const consent = await verifyConsent({ request, userId: identity.userId, accessToken });
    return decidePremiumVisionAuthorization({ identity, plan, featureEnabled: true, consent });
  } catch {
    return decidePremiumVisionAuthorization({ identity, plan, featureEnabled: true, consent: null, dependencyUnavailable: "consent" });
  }
}
