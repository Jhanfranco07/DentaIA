import assert from "node:assert/strict";
import test from "node:test";
import { esPerfilQa, marcadoresQa, perfilQa, perfilesQa, qaPreviewPermitido } from "./qa-preview.ts";

const preview = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "integration/pr71-pr74-compat-20261117",
  DENTAIA_CLINICAL_PREVIEW_ENABLED: "true",
};

test("Los dos odontólogos con cuenta solo se integran al Preview autorizado", () => {
  assert.equal(qaPreviewPermitido(preview), true);
  assert.equal(qaPreviewPermitido({ ...preview, VERCEL_ENV: "production" }), false);
  assert.equal(qaPreviewPermitido({ ...preview, VERCEL_GIT_COMMIT_REF: "main" }), false);
  assert.equal(qaPreviewPermitido({ ...preview, DENTAIA_CLINICAL_PREVIEW_ENABLED: "false" }), false);
  assert.equal(qaPreviewPermitido({}), false);
});

test("Las fichas QA están ligadas a dos ID únicos, sin convertir los registros en activos", () => {
  const dentistas = perfilesQa();
  assert.equal(dentistas.length, 2);
  assert.equal(new Set(dentistas.map(d => d.id)).size, 2);
  for (const d of dentistas) {
    assert.equal(esPerfilQa(d.id), true);
    assert.equal(d.is_demo, true);
    assert.equal(d.is_active, false);
    assert.equal(perfilQa(d.id)?.name, d.name);
    assert.equal(d.ubicaciones.length, 1);
    assert.match(d.ubicaciones[0].practice_address, /no es una dirección de atención/i);
  }
  assert.equal(perfilQa("00000000-0000-4000-8000-000000000099"), undefined);
});

test("Cada marcador de referencia se vincula con su ficha, sin dar direcciones de consulta", () => {
  const dentistas = perfilesQa();
  const marcadores = marcadoresQa();
  assert.equal(marcadores.length, 2);
  assert.deepEqual(new Set(marcadores.map(p => p.dentist_id)), new Set(dentistas.map(d => d.id)));
  for (const m of marcadores) {
    assert.equal(m.tipo, "demo");
    assert.match(m.public_label, /no es un consultorio/i);
    assert.ok(Number.isFinite(m.latitude) && Number.isFinite(m.longitude));
  }
});
