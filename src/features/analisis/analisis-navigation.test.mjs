import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const patientLayout = readFileSync(new URL("../../app/(paciente)/layout.tsx", import.meta.url), "utf8");
const analysisPage = readFileSync(new URL("../../app/(paciente)/analisis/page.tsx", import.meta.url), "utf8");

test("/analisis pertenece al layout del portal paciente", () => {
  assert.match(patientLayout, /PortalShell/);
  assert.match(patientLayout, /NAVEGACION_PACIENTE/);
  assert.match(analysisPage, /AnalisisDental/);
});
