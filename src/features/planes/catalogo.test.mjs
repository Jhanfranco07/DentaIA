import assert from "node:assert/strict";
import test from "node:test";
import { effectivePlan, featureEnabled } from "./catalogo.ts";

test("Basic conserva Smile amarillo y no habilita funciones Premium futuras", () => {
  assert.equal(featureEnabled("basic", "smile_yellow_teeth_basic"), true);
  assert.equal(featureEnabled("basic", "smile_analysis_history"), false);
  assert.equal(featureEnabled("premium", "smile_analysis_history"), false);
  assert.equal(featureEnabled("premium", "premium_visual_evaluation"), false);
});

test("solo una suscripcion activa y vigente habilita Premium", () => {
  const now = new Date("2026-11-16T12:00:00.000Z");
  assert.equal(effectivePlan(null, now), "basic");
  assert.equal(effectivePlan({ status: "past_due", current_period_end: "2026-12-01T00:00:00.000Z" }, now), "basic");
  assert.equal(effectivePlan({ status: "active", current_period_end: "2026-11-16T11:59:59.000Z" }, now), "basic");
  assert.equal(effectivePlan({ status: "active", current_period_end: "2026-12-01T00:00:00.000Z" }, now), "premium");
});
