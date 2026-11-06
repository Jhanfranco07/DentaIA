import test from "node:test";
import assert from "node:assert/strict";
import { panelAdministrativoDisponible, lecturasAdministrativasDisponibles } from "./entorno-panel.ts";

test("panel admin permanece disponible en desarrollo local", () => {
  assert.equal(panelAdministrativoDisponible({ NODE_ENV: "development" }), true);
});

test("panel admin solo se habilita con opt-in en Preview de develop", () => {
  const preview = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "develop", DENTAIA_ADMIN_PREVIEW_ENABLED: "true" };
  assert.equal(panelAdministrativoDisponible(preview), true);
  for (const cambio of [{ DENTAIA_ADMIN_PREVIEW_ENABLED: "false" }, { VERCEL_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "feature/preview-clinical-backend" }, { VERCEL: undefined }, { VERCEL_GIT_COMMIT_REF: "main" }]) {
    assert.equal(panelAdministrativoDisponible({ ...preview, ...cambio }), false);
  }
});

test("lecturas administrativas privilegiadas requieren habilitación local o Preview autorizado", () => {
  const preview = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "develop",
    DENTAIA_ADMIN_PREVIEW_ENABLED: "true", DENTAIA_ADMIN_READS_ENABLED: "true" };
  assert.equal(lecturasAdministrativasDisponibles(preview), true);
  for (const cambio of [{ VERCEL_ENV: "production" }, { VERCEL_GIT_COMMIT_REF: "main" },
    { DENTAIA_ADMIN_READS_ENABLED: "false" }, { DENTAIA_ADMIN_PREVIEW_ENABLED: "false" }]) {
    assert.equal(lecturasAdministrativasDisponibles({ ...preview, ...cambio }), false);
  }
  assert.equal(lecturasAdministrativasDisponibles({ NODE_ENV: "development", DENTAIA_ADMIN_READS_ENABLED: "true" }), true);
});
