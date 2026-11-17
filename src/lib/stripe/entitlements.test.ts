import { describe, expect, it } from "vitest";
import { effectivePlan, featureEnabled } from "@/features/planes/catalogo";

describe("Premium server entitlements", () => {
  const now = new Date("2026-11-16T12:00:00.000Z");

  it("requires an active, unexpired server subscription", () => {
    expect(effectivePlan(null, now)).toBe("basic");
    expect(effectivePlan({ status: "past_due", current_period_end: "2026-12-01T00:00:00.000Z" }, now)).toBe("basic");
    expect(effectivePlan({ status: "active", current_period_end: "2026-11-16T11:59:59.000Z" }, now)).toBe("basic");
    expect(effectivePlan({ status: "active", current_period_end: "2026-12-01T00:00:00.000Z" }, now)).toBe("premium");
  });

  it("keeps future Premium features disabled while Basic Smile remains enabled", () => {
    expect(featureEnabled("basic", "smile_yellow_teeth_basic")).toBe(true);
    for (const feature of [
      "smile_analysis_history",
      "smile_analysis_comparison",
      "smile_share_with_dentist",
      "smile_advanced_analysis",
    ] as const) {
      expect(featureEnabled("premium", feature)).toBe(false);
    }
  });
});
