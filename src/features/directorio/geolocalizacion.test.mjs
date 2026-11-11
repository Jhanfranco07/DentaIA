import test from "node:test";
import assert from "node:assert/strict";
import { coordenadasValidas, distanciaEnKm, filtrarPorRadio, formatearDistancia, mensajeErrorUbicacion, obtenerUbicacionActual, ordenarPorProximidad } from "./geolocalizacion.ts";

test("valida coordenadas sin aceptar NaN ni límites fuera de rango", () => {
  assert.equal(coordenadasValidas(-12.05, -77.04), true);
  assert.equal(coordenadasValidas(91, 0), false);
  assert.equal(coordenadasValidas(0, -181), false);
  assert.equal(coordenadasValidas(NaN, 0), false);
});

test("calcula distancia esférica aproximada, no tiempo ni ruta vial", () => {
  const lima = { latitude: -12.0464, longitude: -77.0428 };
  assert.equal(distanciaEnKm(lima, lima), 0);
  const norte = distanciaEnKm(lima, { latitude: -11.95, longitude: -77.04 });
  assert.ok(norte && norte > 10 && norte < 12);
  assert.match(formatearDistancia(norte), /en línea recta/);
  assert.equal(distanciaEnKm(lima, { latitude: NaN, longitude: 0 }), null);
});

test("filtra dentro del radio y ordena ubicaciones válidas antes de las ausentes", () => {
  const base = { latitude: -12.0464, longitude: -77.0428 };
  const dentistas = [{ id: "cerca", latitude: -12.05, longitude: -77.04 }, { id: "lejos", latitude: -11.9, longitude: -77.04 }, { id: "sin-ubicacion", latitude: null, longitude: null }];
  assert.deepEqual(filtrarPorRadio(dentistas, base, 5).map(d => d.id), ["cerca"]);
  assert.deepEqual(ordenarPorProximidad(dentistas, base).map(d => d.id), ["cerca", "lejos", "sin-ubicacion"]);
});

test("ubica solo a petición del llamador y rechaza precisión superior a un kilómetro", async () => {
  let options;
  const fake = { getCurrentPosition(success, _error, requested) { options = requested; success({ coords: { latitude: -12, longitude: -77, accuracy: 42 } }); } };
  assert.deepEqual(await obtenerUbicacionActual(fake), { latitude: -12, longitude: -77, accuracy: 42 });
  assert.equal(options.maximumAge, 0);
  assert.equal(options.timeout, 15000);
  await assert.rejects(() => obtenerUbicacionActual({ getCurrentPosition(success) { success({ coords: { latitude: -12, longitude: -77, accuracy: 1001 } }); } }), /PRECISION/);
});

test("traduce denegación, indisponibilidad, timeout e incompatibilidad", () => {
  assert.match(mensajeErrorUbicacion(1), /permiso/);
  assert.match(mensajeErrorUbicacion(2), /GPS/);
  assert.match(mensajeErrorUbicacion(3), /tardó demasiado/);
  assert.match(mensajeErrorUbicacion("incompatible"), /no permite/);
  assert.match(mensajeErrorUbicacion("precision"), /precisión suficiente/);
});
