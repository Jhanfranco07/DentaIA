import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/premium-vision/server", () => ({ authorizePremiumVisionRequest: vi.fn() }));
vi.mock("@/lib/supabase/request.server", () => ({ createUserScopedSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/server-auth", () => ({ getAccessTokenFromRequest: vi.fn() }));

import { authorizePremiumVisionRequest } from "./server";
import { persistPremiumVisionResult, type PersistEvaluation } from "./history-server";

afterEach(() => vi.unstubAllEnvs());

describe("DI-214 ingestion boundary", () => {
  it("rejects a write before authorization when the separate ingest switch is off", async () => {
    vi.stubEnv("DENTAIA_PREMIUM_INGEST_ENABLED", "false");
    await expect(persistPremiumVisionResult(
      new Request("https://dentaia.test/"), async () => ({ granted: false, reason: "missing" }),
      {} as PersistEvaluation,
    )).rejects.toThrow("PREMIUM_INGEST_UNAVAILABLE");
    expect(authorizePremiumVisionRequest).not.toHaveBeenCalled();
  });

  it("rejects a write when ingestion is configured but RF-DETR is off", async () => {
    vi.stubEnv("DENTAIA_PREMIUM_INGEST_ENABLED", "true");
    vi.stubEnv("DENTAIA_PREMIUM_INGEST_HMAC_HEX", "a".repeat(64));
    vi.stubEnv("DENTAIA_RFDETR_ENABLED", "false");
    await expect(persistPremiumVisionResult(
      new Request("https://dentaia.test/"), async () => ({ granted: false, reason: "missing" }),
      {} as PersistEvaluation,
    )).rejects.toThrow("PREMIUM_INGEST_UNAVAILABLE");
    expect(authorizePremiumVisionRequest).not.toHaveBeenCalled();
  });
});
