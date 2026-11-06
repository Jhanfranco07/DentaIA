import test from "node:test";
import assert from "node:assert/strict";
import { rolesDesdeAppMetadata, rutaPrincipalPorRoles, puedeAccederModulo } from "./roles.ts";

const asignacion = roles => ({ dentaia: { version: 1, estado: "activo", roles } });

test("roles de módulo: acepta solo la asignación activa de app_metadata", () => {
  assert.deepEqual(rolesDesdeAppMetadata(asignacion(["paciente"])), ["paciente"]);
  assert.deepEqual(rolesDesdeAppMetadata(asignacion(["odontologo", "paciente"])), ["odontologo", "paciente"]);
  assert.deepEqual(rolesDesdeAppMetadata({ ...asignacion(["paciente"]), user_metadata: asignacion(["superusuario"]) }), ["paciente"]);
});

test("roles de módulo: asignación ausente, inválida, duplicada o suspendida deniega", () => {
  for (const metadata of [null, {}, { user_metadata: asignacion(["superusuario"]) },
    asignacion(["administrador"]), asignacion(["paciente", "paciente"]),
    { dentaia: { version: 1, estado: "suspendido", roles: ["odontologo"] } },
    { dentaia: { version: 2, estado: "activo", roles: ["paciente"] } }]) {
    assert.deepEqual(rolesDesdeAppMetadata(metadata), []);
  }
});

test("destino por defecto para roles múltiples: superusuario, odontólogo, paciente", () => {
  assert.equal(rutaPrincipalPorRoles(["paciente"]), "/panel");
  assert.equal(rutaPrincipalPorRoles(["odontologo"]), "/profesional");
  assert.equal(rutaPrincipalPorRoles(["superusuario"]), "/administracion");
  assert.equal(rutaPrincipalPorRoles(["paciente", "odontologo"]), "/profesional");
  assert.equal(rutaPrincipalPorRoles(["paciente", "superusuario"]), "/administracion");
  assert.equal(rutaPrincipalPorRoles([]), null);
});

test("la asignación de URL no concede módulo: rutas paciente, profesional y administración se separan", () => {
  assert.equal(puedeAccederModulo(["paciente"], ["odontologo"]), false);
  assert.equal(puedeAccederModulo(["odontologo"], ["paciente"]), false);
  assert.equal(puedeAccederModulo(["odontologo"], ["superusuario"]), false);
  assert.equal(puedeAccederModulo(["superusuario"], ["paciente"]), false);
  assert.equal(puedeAccederModulo(["paciente", "odontologo"], ["odontologo"]), true);
});
