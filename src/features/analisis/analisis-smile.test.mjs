import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./AnalisisDental.tsx", import.meta.url), "utf8");
const contract = readFileSync(new URL("./smile-contract.ts", import.meta.url), "utf8");
const smileRoute = readFileSync(new URL("../../app/api/desarrollo/dentaia-smile/route.ts", import.meta.url), "utf8");
const smilePreview = readFileSync(new URL("./smile-preview.ts", import.meta.url), "utf8");

test("Smile exige consentimiento explícito y una acción antes de enviar la fotografía", () => {
  assert.match(page, /checked=\{consentimiento\}/);
  assert.match(page, /disabled=\{!archivo \|\| !consentimiento\}/);
  assert.match(page, /if \(!archivo \|\| !consentimiento\) return/);
  assert.match(page, /body\.set\("file", archivo\)/);
  assert.match(page, /fetch\("\/api\/desarrollo\/dentaia-smile"/);
  assert.match(page, /onClick=\{\(\) => void analizar\(\)\}/);
});

test("Smile Preview requires a branch-gated HTTPS target and service secret", () => {
  for (const text of ["VERCEL_ENV", "VERCEL_GIT_COMMIT_REF", "DENTAIA_SMILE_PREVIEW_ENABLED", "DENTAIA_SMILE_SERVICE_SECRET", "target.protocol === \"https:\"", "NODE_ENV === \"development\""])
    assert.ok(smilePreview.includes(text));
  assert.match(smileRoute, /X-Dentaia-Smile-Secret/);
});

test("Smile envía únicamente resúmenes técnicos de color y posición al endpoint autenticado de explicación", () => {
  assert.match(page, /getSupabaseBrowserClient\(\)\.auth\.getSession/);
  assert.match(page, /Authorization: `Bearer \$\{data\.session\.access_token\}`/);
  assert.match(page, /fetch\("\/api\/desarrollo\/dentaia-smile\/explain"/);
  assert.match(page, /body: JSON\.stringify\(\{ \.\.\.result, /);
  assert.match(page, /oral_analysis: \{ status: oralResult\.status, model: oralResult\.model/);
  assert.doesNotMatch(page, /body: JSON\.stringify\(\{[^\n]*overlay_url/);
  assert.doesNotMatch(page, /JSON\.stringify\(archivo\)/);
  assert.match(page, /explicacionSolicitada/);
  assert.match(page, /AbortController/);
  assert.match(contract, /model: "teeth-4coz7\/1"/);
});

test("el resultado conserva estados y orientación educativa sin gráfico técnico", () => {
  for (const text of ["Preparación", "Carga", "Análisis", "Resultado", "Reintentar", "not_evaluable", "no constituye diagnóstico", "no confirma una condición dental"])
    assert.match(page, new RegExp(text, "i"));
  assert.match(page, /aria-live="polite"/);
  assert.doesNotMatch(page, /Aspecto visual por diente detectado/);
  assert.doesNotMatch(page, /Componente amarillo por región/);
});
