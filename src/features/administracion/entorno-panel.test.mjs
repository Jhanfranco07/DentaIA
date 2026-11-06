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

test("regresión: el enlace de cuenta resuelve el panel en Production de main", async () => {
  const { rutaPrincipalPorRoles } = await import("../autorizacion/roles.ts");
  const { NAVEGACION_ADMIN } = await import("../../components/navegacion-portal.ts");
  assert.equal(rutaPrincipalPorRoles(["superusuario"]), "/administracion");
  assert.equal(NAVEGACION_ADMIN[0].href, "/administracion");
  assert.equal(panelAdministrativoDisponible({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }), true);
});

test("Production no habilita otros despliegues ni sustituye el opt-in de lectura", () => {
  const production = { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
  for (const cambio of [{ VERCEL_GIT_COMMIT_REF: "develop" }, { VERCEL_GIT_COMMIT_REF: undefined },
    { VERCEL_ENV: "preview" }, { VERCEL: undefined }, { NODE_ENV: "development" }]) {
    assert.equal(panelAdministrativoDisponible({ ...production, ...cambio }), false);
  }
  assert.equal(lecturasAdministrativasDisponibles(production), false);
  assert.equal(lecturasAdministrativasDisponibles({ ...production, DENTAIA_ADMIN_READS_ENABLED: "TRUE" }), false);
  assert.equal(lecturasAdministrativasDisponibles({ ...production, DENTAIA_ADMIN_READS_ENABLED: "true" }), true);
});
