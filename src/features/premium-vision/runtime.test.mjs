import assert from "node:assert/strict";
import test from "node:test";
import { rfdetrRuntime } from "./runtime.ts";

const configured = {
  DENTAIA_RFDETR_ENABLED: "true", DENTAIA_RFDETR_API_URL: "https://vision.example.test/analyze",
  DENTAIA_RFDETR_SERVICE_SECRET: "a".repeat(32),
};

test("RF-DETR stays off by default and needs a second production flag", () => {
  assert.equal(rfdetrRuntime({}).enabled, false);
  assert.equal(rfdetrRuntime({ ...configured, VERCEL_ENV: "production" }).enabled, false);
  assert.equal(rfdetrRuntime({ ...configured, NODE_ENV: "production" }).enabled, false);
  assert.equal(rfdetrRuntime({ ...configured, VERCEL_ENV: "production", DENTAIA_RFDETR_PRODUCTION_ENABLED: "true" }).enabled, true);
});

test("RF-DETR requires a strong secret and a fixed HTTPS endpoint", () => {
  assert.equal(rfdetrRuntime({ ...configured, DENTAIA_RFDETR_SERVICE_SECRET: "short" }).enabled, false);
  assert.equal(rfdetrRuntime({ ...configured, DENTAIA_RFDETR_API_URL: "http://evil.test/analyze" }).enabled, false);
  assert.equal(rfdetrRuntime({ ...configured, DENTAIA_RFDETR_API_URL: "https://evil.test/other" }).enabled, false);
  assert.equal(rfdetrRuntime(configured).enabled, true);
});
