import test from "node:test";
import assert from "node:assert/strict";
import { crearMarcadores, tieneUbicacionDentroDelRadio, ubicacionConCoordenadasValidas, ubicacionMasCercana } from "./ubicaciones.ts";

const consultorio = (id, latitude, longitude) => ({
  id, dentist_id: "dentista-1", practice_name: `Consultorio ${id}`, practice_address: "Dirección publicada",
  latitude, longitude, created_at: "2026-01-01T00:00:00Z",
});
const odontologo = { id: "dentista-1", name: "Perfil profesional", is_demo: false, ubicaciones: [
  consultorio("lejano", -12.2, -77.1), consultorio("cercano", -12.05, -77.04),
] };

test("elige el consultorio más cercano entre varias sedes sin convertirlo en distancia vial", () => {
  const resultado = ubicacionMasCercana(odontologo.ubicaciones, { latitude: -12.0464, longitude: -77.0428 });
  assert.equal(resultado?.ubicacion.id, "cercano");
  assert.ok((resultado?.distancia ?? 99) < 1);
  assert.equal(ubicacionMasCercana([], null), null);
});

test("el radio incluye al odontólogo si alguna sede publicada cae dentro", () => {
  const origen = { latitude: -12.0464, longitude: -77.0428 };
  assert.equal(tieneUbicacionDentroDelRadio(odontologo.ubicaciones, origen, 2), true);
  assert.equal(tieneUbicacionDentroDelRadio([odontologo.ubicaciones[0]], origen, 2), false);
  assert.equal(tieneUbicacionDentroDelRadio([], origen, 2), false);
});

test("crea un marcador por ubicación y mantiene vínculo al perfil, sin incluir datos de clínica internos", () => {
  const marcadores = crearMarcadores([odontologo]);
  assert.equal(marcadores.length, 2);
  assert.equal(marcadores[0].dentist_id, "dentista-1");
  assert.equal(marcadores[0].dentista.is_demo, false);
  assert.equal("clinic_id" in marcadores[0], false);
  assert.equal(crearMarcadores([{ ...odontologo, ubicaciones: [] }]).length, 0);
});

test("no promueve perfiles académicos ficticios a marcadores de consultorio aunque traigan ubicaciones", () => {
  assert.deepEqual(crearMarcadores([{ ...odontologo, is_demo: true }]), []);
});

test("descarta ubicaciones con coordenadas ausentes, no finitas o fuera de rango", () => {
  const validas = [consultorio("valida", -12.05, -77.04)];
  const invalidas = [consultorio("nan", NaN, -77), consultorio("latitud", 91, 0), consultorio("longitud", 0, 181)];
  const todas = [...validas, ...invalidas];

  assert.equal(ubicacionConCoordenadasValidas(validas[0]), true);
  invalidas.forEach(ubicacion => assert.equal(ubicacionConCoordenadasValidas(ubicacion), false));
  assert.deepEqual(ubicacionMasCercana(todas, null)?.ubicacion.id, "valida");
  assert.deepEqual(crearMarcadores([{ ...odontologo, ubicaciones: todas }]).map(m => m.id), ["valida"]);
  assert.equal(ubicacionMasCercana(invalidas, null), null);
});
