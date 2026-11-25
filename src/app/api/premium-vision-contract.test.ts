import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  authorizeIdentity: vi.fn(),
  featureEnabled: vi.fn(),
  readEffectivePlan: vi.fn(),
  readAccessToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/autorizacion/vision-demo-server", () => ({ authorizeVisionDemoRequest: dependencies.authorizeIdentity }));
vi.mock("@/features/planes/catalogo", () => ({ featureEnabled: dependencies.featureEnabled }));
vi.mock("@/features/planes/premium-server", () => ({ readEffectivePlan: dependencies.readEffectivePlan }));
vi.mock("@/lib/supabase/server-auth", () => ({ getAccessTokenFromRequest: dependencies.readAccessToken }));

import { authorizePremiumVisionRequest } from "@/features/premium-vision/server";

const request = new Request("https://dentaia.test/api/future-premium-vision", {
  headers: { authorization: "Bearer synthetic-token" },
});
const consent = {
  granted: true,
  scope: "temporary_premium_evaluation",
  version: "premium-vision-processing-v1",
  source: "request_acknowledgement",
  consentId: null,
} as const;

describe("Premium Vision server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.authorizeIdentity.mockResolvedValue({ allowed: true, userId: "11111111-2222-4333-8444-555555555555" });
    dependencies.readAccessToken.mockReturnValue("synthetic-token");
    dependencies.readEffectivePlan.mockResolvedValue("premium");
    dependencies.featureEnabled.mockReturnValue(false);
  });

  it("detiene el flujo antes del plan cuando la identidad es rechazada", async () => {
    dependencies.authorizeIdentity.mockResolvedValue({ allowed: false, status: 401, code: "AUTH_REQUIRED" });
    const verifyConsent = vi.fn();

    await expect(authorizePremiumVisionRequest(request, verifyConsent)).resolves.toEqual({ allowed: false, status: 401, code: "AUTH_REQUIRED" });
    expect(dependencies.readEffectivePlan).not.toHaveBeenCalled();
    expect(verifyConsent).not.toHaveBeenCalled();
  });

  it("mantiene la capacidad deshabilitada y no consulta consentimiento", async () => {
    const verifyConsent = vi.fn();

    await expect(authorizePremiumVisionRequest(request, verifyConsent)).resolves.toEqual({ allowed: false, status: 503, code: "FEATURE_NOT_ENABLED" });
    expect(dependencies.featureEnabled).toHaveBeenCalledWith("premium", "premium_visual_evaluation");
    expect(verifyConsent).not.toHaveBeenCalled();
  });

  it("falla cerrado cuando el plan o el consentimiento no están disponibles", async () => {
    dependencies.readEffectivePlan.mockRejectedValueOnce(new Error("unavailable"));
    await expect(authorizePremiumVisionRequest(request, vi.fn())).resolves.toMatchObject({ allowed: false, status: 503, code: "AUTH_UNAVAILABLE" });

    dependencies.featureEnabled.mockReturnValue(true);
    const verifyConsent = vi.fn().mockRejectedValue(new Error("unavailable"));
    await expect(authorizePremiumVisionRequest(request, verifyConsent)).resolves.toEqual({ allowed: false, status: 503, code: "CONSENT_UNAVAILABLE" });
  });

  it("autoriza solo después de identidad, plan, capacidad y consentimiento válidos", async () => {
    dependencies.featureEnabled.mockReturnValue(true);
    const verifyConsent = vi.fn().mockResolvedValue(consent);

    await expect(authorizePremiumVisionRequest(request, verifyConsent)).resolves.toMatchObject({ allowed: true, consent });
    expect(verifyConsent).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "synthetic-token" }));
  });
});
