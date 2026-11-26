import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(), limit: vi.fn(), premiumAuth: vi.fn(), premiumEvaluate: vi.fn(), provider: vi.fn(),
  smileRuntime: vi.fn(), rfdetrRuntime: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/autorizacion/vision-demo-server", () => ({
  authorizeVisionDemoRequest: mocks.identity, consumeVisionAnalysisRequestLimit: mocks.limit,
}));
vi.mock("@/features/premium-vision/server", () => ({ authorizePremiumVisionRequest: mocks.premiumAuth }));
vi.mock("@/features/premium-vision/runtime", () => ({ rfdetrRuntime: mocks.rfdetrRuntime }));
vi.mock("@/features/premium-vision/http-provider", () => ({ createRfdetrHttpProvider: mocks.provider }));
vi.mock("@/features/premium-vision/provider", () => ({ evaluateWithPremiumVisionProvider: mocks.premiumEvaluate }));
vi.mock("@/features/analisis/smile-preview", () => ({ smileRuntime: mocks.smileRuntime }));

import { POST } from "./route";

const smile = { result: { status: "evaluable", model: "teeth-4coz7/1", image_width: 16, image_height: 16,
  inference_ms: 1, analysis_ms: 1, thresholds: {}, detected_regions: 0, evaluable_regions: 0,
  lighting_quality: "adequate", regions: [], warnings: [], limitations: [] } };

function request(premium = false) {
  const body = new FormData();
  body.set("file", new File([new Uint8Array([1, 2, 3])], "synthetic.png", { type: "image/png" }));
  return new NextRequest("https://dentaia.test/api/desarrollo/dentaia-smile", {
    method: "POST", body, headers: premium ? {
      "Authorization": "Bearer synthetic-token",
      "X-Dentaia-Premium-Processing-Consent": "premium-vision-processing-v1",
    } : { "Authorization": "Bearer synthetic-token" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ allowed: true, userId: "11111111-1111-4111-8111-111111111111" });
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.smileRuntime.mockReturnValue({ enabled: true, target: new URL("https://smile.test/analyze") });
  mocks.rfdetrRuntime.mockReturnValue({ enabled: false, reason: "disabled" });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(smile)));
});

describe("Smile plus opt-in Premium orchestration", () => {
  it("preserves the Smile response and consumes one limit without Premium consent", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(smile);
    expect(mocks.limit).toHaveBeenCalledTimes(1);
    expect(mocks.premiumAuth).not.toHaveBeenCalled();
    expect(mocks.premiumEvaluate).not.toHaveBeenCalled();
  });

  it("denies a Premium request before consuming quota when the capability is off", async () => {
    const response = await POST(request(true));
    expect(response.status).toBe(503);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects expired or Free Premium access before reading the image", async () => {
    mocks.rfdetrRuntime.mockReturnValue({ enabled: true });
    mocks.premiumAuth.mockResolvedValue({ allowed: false, status: 403, code: "PREMIUM_REQUIRED" });
    const response = await POST(request(true));
    expect(response.status).toBe(403);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("keeps Smile valid and reports provider failure explicitly with one quota consumption", async () => {
    mocks.rfdetrRuntime.mockReturnValue({ enabled: true, target: new URL("https://rfdetr.test/analyze"), serviceSecret: "x".repeat(32) });
    mocks.premiumAuth.mockResolvedValue({ allowed: true });
    mocks.premiumEvaluate.mockRejectedValue(new Error("synthetic unavailable"));
    const response = await POST(request(true));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...smile, premium_vision_error: "provider_unavailable" });
    expect(mocks.limit).toHaveBeenCalledTimes(1);
    expect(mocks.premiumEvaluate).toHaveBeenCalledTimes(1);
  });

  it("adds a versioned Premium result without altering the Smile payload", async () => {
    mocks.rfdetrRuntime.mockReturnValue({ enabled: true, target: new URL("https://rfdetr.test/analyze"), serviceSecret: "x".repeat(32) });
    mocks.premiumAuth.mockResolvedValue({ allowed: true });
    const premium = { schema_version: "dentaia.premium-vision-result.v1", evaluation: { status: "evaluated_no_detections" } };
    mocks.premiumEvaluate.mockResolvedValue(premium);
    const response = await POST(request(true));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...smile, premium_vision: premium });
    expect(mocks.limit).toHaveBeenCalledTimes(1);
    expect(mocks.premiumEvaluate).toHaveBeenCalledTimes(1);
  });
});
