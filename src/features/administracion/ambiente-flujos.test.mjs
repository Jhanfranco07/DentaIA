import test from "node:test";
import assert from "node:assert/strict";
import { flujosAdministrativosHabilitados } from "./ambiente-flujos.ts";

const optIn = { DENTAIA_ADMIN_WORKFLOWS_ENABLED: "true" };
test("los flujos administrativos se habilitan en desarrollo local con opt-in", () => {
  assert.equal(flujosAdministrativosHabilitados({ ...optIn, NODE_ENV: "development" }), true);
  assert.equal(flujosAdministrativosHabilitados({ ...optIn, NODE_ENV: "development", VERCEL: "1" }), false);
});
test("el opt-in compartido se limita a Preview de develop", () => {
  const preview = { ...optIn, NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "develop" };
  assert.equal(flujosAdministrativosHabilitados(preview), true);
  for (const change of [{ VERCEL_ENV: "production" }, { VERCEL_GIT_COMMIT_REF: "main" }, { VERCEL_GIT_COMMIT_REF: "feature/x" }, { VERCEL: undefined }, { DENTAIA_ADMIN_WORKFLOWS_ENABLED: "false" }]) {
    assert.equal(flujosAdministrativosHabilitados({ ...preview, ...change }), false);
  }
});
