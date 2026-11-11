import test from "node:test";
import assert from "node:assert/strict";

import {
  CASOS_HISTORIAL_DEMO,
  formatearFechaClinica,
  iniciarConsultaHistorial,
  ordenarAtenciones,
  resolverConsultaHistorial,
  textoCampoClinico,
} from "./historial-sintetico.ts";

test("ordena las atenciones por fecha de atención sin mutar la fixture", () => {
  const caso = CASOS_HISTORIAL_DEMO[0];
  const ordenOriginal = caso.entries.map((entrada) => entrada.encounterId);
  const ordenado = ordenarAtenciones(caso.entries);

  assert.deepEqual(
    ordenado.map((entrada) => entrada.encounterId),
    ["atencion-demo-a-2", "atencion-demo-a-1"],
  );
  assert.deepEqual(
    caso.entries.map((entrada) => entrada.encounterId),
    ordenOriginal,
  );
});

test("distingue dato no registrado, desconocido y registrado", () => {
  assert.equal(
    textoCampoClinico({ estado: "no_registrado" }),
    "No registrado en la fuente sintética.",
  );
  assert.equal(
    textoCampoClinico({ estado: "desconocido" }),
    "Dato desconocido en la fuente sintética.",
  );
  assert.equal(
    textoCampoClinico({ estado: "registrado", valor: "Dato sintético." }),
    "Dato sintético.",
  );
});

test("formatea fechas ISO válidas y protege frente a fechas inválidas", () => {
  assert.match(formatearFechaClinica("2026-10-09"), /2026/);
  assert.equal(formatearFechaClinica("09/10/2026"), "Fecha no disponible");
  assert.equal(formatearFechaClinica("2026-15-09"), "Fecha no disponible");
  assert.equal(formatearFechaClinica("2026-02-29"), "Fecha no disponible");
});

test("la transición de carga limpia cualquier dato anterior", () => {
  assert.deepEqual(iniciarConsultaHistorial(), {
    estado: "cargando",
    caso: null,
    entries: [],
  });
});

test("el escenario con contenido devuelve solo el caso seleccionado", () => {
  const vista = resolverConsultaHistorial(
    "paciente-demo-b",
    "contenido",
  );

  assert.equal(vista.estado, "listo");
  assert.equal(vista.caso?.patientId, "paciente-demo-b");
  assert.equal(vista.entries.length, 2);
  assert.equal(vista.entries[0].encounterId, "atencion-demo-b-2");
});

test("los escenarios vacío, denegado y error no conservan entradas clínicas", () => {
  for (const escenario of ["vacio", "denegado", "error"]) {
    const vista = resolverConsultaHistorial("paciente-demo-a", escenario);

    assert.equal(vista.estado, escenario);
    assert.equal(vista.caso, null);
    assert.deepEqual(vista.entries, []);
  }
});

test("un caso desconocido falla sin revelar información", () => {
  const vista = resolverConsultaHistorial("paciente-inexistente", "contenido");

  assert.equal(vista.estado, "error");
  assert.equal(vista.caso, null);
  assert.deepEqual(vista.entries, []);
});
