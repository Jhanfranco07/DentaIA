import assert from "node:assert/strict";
import test from "node:test";
import { SMILE_PREVIEW_BRANCH, SMILE_INTEGRATION_PREVIEW_BRANCH, smileRuntime } from "./smile-preview.ts";

const enabledPreview = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: SMILE_PREVIEW_BRANCH,
  DENTAIA_SMILE_PREVIEW_ENABLED: "true",
  DENTAIA_SMILE_SERVICE_SECRET: "x".repeat(32),
  DENTAIA_SMILE_API_URL: "https://dentaia-production.up.railway.app/analyze",
};

test("habilita únicamente el Preview esperado con HTTPS y secreto interno", () => {
  const runtime = smileRuntime(enabledPreview);
  assert.equal(runtime.enabled, true);
  if (runtime.enabled) assert.equal(runtime.target.pathname, "/analyze");
});

test("diagnostica la variable de sistema de rama ausente sin revelar configuraciones", () => {
  const { VERCEL_GIT_COMMIT_REF: _, ...withoutBranch } = enabledPreview;
  const runtime = smileRuntime(withoutBranch);
  assert.deepEqual(runtime, { enabled: false, failedChecks: ["branch_missing_or_not_allowed"] });
});

test("Production y las configuraciones incompletas permanecen bloqueadas", () => {
  const production = smileRuntime({ ...enabledPreview, VERCEL_ENV: "production" });
  assert.equal(production.enabled, false);
  if (!production.enabled) assert.ok(production.failedChecks.includes("environment_not_enabled"));

  const missingSecret = smileRuntime({ ...enabledPreview, DENTAIA_SMILE_SERVICE_SECRET: "short" });
  assert.equal(missingSecret.enabled, false);
  if (!missingSecret.enabled) assert.ok(missingSecret.failedChecks.includes("service_secret_missing_or_too_short"));
});

test("Production requiere una habilitación explícita y conserva HTTPS y secreto", () => {
  const runtime = smileRuntime({ ...enabledPreview, VERCEL_ENV: "production", DENTAIA_SMILE_PRODUCTION_ENABLED: "true" });
  assert.equal(runtime.enabled, true);
});
test("autoriza solo la rama de integración en Preview con secreto y destino válidos", () => {
  assert.equal(smileRuntime({ ...enabledPreview, VERCEL_GIT_COMMIT_REF: SMILE_INTEGRATION_PREVIEW_BRANCH }).enabled, true);
  const denied = smileRuntime({ ...enabledPreview, VERCEL_GIT_COMMIT_REF: "feature/random" });
  assert.equal(denied.enabled, false);
  assert.equal(smileRuntime({ ...enabledPreview, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: SMILE_INTEGRATION_PREVIEW_BRANCH }).enabled, false);
});
