import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decidePremiumVisionAuthorization } from "./authorization.ts";

const userId = "11111111-2222-4333-8444-555555555555";
const identity = { allowed: true, userId };
const consent = {
  granted: true,
  scope: "temporary_premium_evaluation",
  version: "premium-vision-processing-v1",
  source: "request_acknowledgement",
  consentId: null,
};

test("preserva las denegaciones de la autorización de visión existente", () => {
  const denied = { allowed: false, status: 401, code: "AUTH_REQUIRED" };
  assert.deepEqual(decidePremiumVisionAuthorization({ identity: denied, plan: null, featureEnabled: false, consent: null }), denied);
});

test("exige plan Premium resuelto por servidor y una capacidad explícitamente habilitada", () => {
  assert.deepEqual(decidePremiumVisionAuthorization({ identity, plan: "basic", featureEnabled: true, consent }),
    { allowed: false, status: 403, code: "PREMIUM_REQUIRED" });
  assert.deepEqual(decidePremiumVisionAuthorization({ identity, plan: "premium", featureEnabled: false, consent }),
    { allowed: false, status: 503, code: "FEATURE_NOT_ENABLED" });
});

test("exige consentimiento específico de procesamiento temporal", () => {
  for (const invalid of [
    null,
    { granted: false, reason: "missing" },
    { ...consent, scope: "storage" },
    { ...consent, version: "" },
    { ...consent, consentId: "not-a-uuid" },
    { ...consent, source: "persisted_record", consentId: null },
  ]) {
    assert.deepEqual(decidePremiumVisionAuthorization({ identity, plan: "premium", featureEnabled: true, consent: invalid }),
      { allowed: false, status: 403, code: "PROCESSING_CONSENT_REQUIRED" });
  }
});

test("autoriza únicamente al componer identidad, plan, capacidad y consentimiento válidos", () => {
  assert.deepEqual(decidePremiumVisionAuthorization({ identity, plan: "premium", featureEnabled: true, consent }),
    { allowed: true, userId, consent });
});

test("falla cerrado cuando no se puede verificar plan o consentimiento", () => {
  assert.equal(decidePremiumVisionAuthorization({ identity, plan: null, featureEnabled: false, consent: null, dependencyUnavailable: "plan" }).status, 503);
  assert.deepEqual(decidePremiumVisionAuthorization({ identity, plan: "premium", featureEnabled: true, consent: null, dependencyUnavailable: "consent" }),
    { allowed: false, status: 503, code: "CONSENT_UNAVAILABLE" });
});

test("el adaptador de servidor reutiliza identidad y plan existentes", () => {
  const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  const catalog = readFileSync(new URL("../planes/catalogo.ts", import.meta.url), "utf8");
  assert.match(server, /authorizeVisionDemoRequest\(request\.headers\)/);
  assert.match(server, /readEffectivePlan\(accessToken\)/);
  assert.match(server, /verifyConsent\(\{ request, userId: identity\.userId, accessToken \}\)/);
  assert.match(catalog, /premium_visual_evaluation: \{ minimumPlan: "premium", implemented: true \}/);
  assert.doesNotMatch(server, /fetch\(/);
});
