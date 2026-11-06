import test from "node:test";
import assert from "node:assert/strict";
import { crearMarcadorDemo } from "./demo.ts";
import { crearMarcadores } from "./ubicaciones.ts";

const demo = {
  id: "demo-la-molina",
  slug: "clinica-demo-la-molina",
  name: "Clínica Dental Demo La Molina",
  district: "La Molina",
  city: "Lima",
  country: "Perú",
  latitude: -12.078,
  longitude: -76.911,
  is_demo: true,
  is_published: true,
  requests_enabled: false,
  public_label: "DEMO — Clínica ficticia, no ofrece atención real",
};

test("crea un marcador DEMO claramente rotulado, geográficamente válido y sin relación clínica", () => {
  const marker = crearMarcadorDemo(demo);
  assert.equal(marker?.tipo, "demo");
  assert.equal(marker?.public_label, "DEMO — Clínica ficticia, no ofrece atención real");
  assert.equal(marker?.latitude, -12.078);
  assert.equal(marker?.longitude, -76.911);
  assert.equal("dentist_id" in marker, false);
  assert.equal("clinic_id" in marker, false);
});

test("rechaza marcadores DEMO ocultos, con texto cambiado, coordenadas inválidas o solicitudes activadas", () => {
  assert.equal(crearMarcadorDemo({ ...demo, is_published: false }), null);
  assert.equal(crearMarcadorDemo({ ...demo, public_label: "Clínica recomendada" }), null);
  assert.equal(crearMarcadorDemo({ ...demo, latitude: 91 }), null);
  assert.equal(crearMarcadorDemo({ ...demo, requests_enabled: true }), null);
  assert.equal(crearMarcadorDemo({ ...demo, is_demo: false }), null);
});

test("los marcadores de consultorios verificados siguen saliendo solo de ubicaciones dentales publicadas", () => {
  const dentista = { id: "dentista-real", name: "Perfil", is_demo: false, ubicaciones: [] };
  assert.deepEqual(crearMarcadores([dentista]), []);
});
