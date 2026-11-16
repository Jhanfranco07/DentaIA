import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./AnalisisDental.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../../app/api/desarrollo/vision-poc/route.ts", import.meta.url), "utf8");
const explain = readFileSync(new URL("../../app/api/desarrollo/vision-poc/explain/route.ts", import.meta.url), "utf8");

test("analysis requires explicit consent and verifies both public hashes before upload", () => {
  assert.match(page, /checked=\{consentimiento\}/);
  assert.match(page, /disabled=\{!muestraPublica \|\| !consentimiento \|\| analizando\}/);
  assert.match(page, /if \(!PUBLIC_SAMPLE_HASHES\.has\(hash\)\) throw/);
  assert.match(page, /fetch\("\/api\/desarrollo\/vision-poc"/);
  assert.match(page, /5dc8ba6309984f4c44050dc672051ccb2e60e66992a373910f9c225a9c483be4/);
  assert.match(page, /2f50d26eb8c907bc391432e1022c2240ec61010bba7fc65d1104cbbdc4905569/);
  assert.match(api, /PUBLIC_SAMPLE_HASHES/);
  assert.match(api, /createHash\("sha256"\)/);
});

test("analysis authenticates both endpoints and presents ONNX results safely", () => {
  assert.match(page, /getSupabaseBrowserClient\(\)\.auth\.getSession\(\)/);
  assert.match(page, /fetch\("\/api\/desarrollo\/vision-poc\/explain"/);
  assert.match(page, /detection|detecciones/i);
  assert.match(page, /inference_ms/);
  assert.match(page, /Explicaci/);
  assert.match(page, /OpenAI/);
  assert.match(page, /Texto predeterminado/);
  assert.match(page, /No hay detecciones/);
  assert.match(explain, /authorizeVisionDemoRequest/);
});

test("educational scope and public sample restriction stay visible", () => {
  assert.match(page, /muestras .*blicas verificadas/);
  assert.match(page, /Las fotos privadas/);
  assert.match(page, /Herramienta educativa, no diagn/);
  assert.doesNotMatch(page, /Motor no disponible/);
});
