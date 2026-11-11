import test from "node:test";
import assert from "node:assert/strict";

import { contarSolicitudes, resolverReporte } from "./logica.ts";
import { CASOS } from "../analisis/casos.ts";
import { ETAPAS } from "../analisis/flujo.ts";

const FECHA = "2026-11-02T10:00:00.000Z";
const IDS = CASOS.map((c) => c.id);

// contarSolicitudes

test("contarSolicitudes: sin solicitudes devuelve ceros", () => {
  assert.deepEqual(contarSolicitudes([]), { solicitudes: 0, pendientes: 0 });
});

test("contarSolicitudes: solo las solicitadas cuentan como pendientes", () => {
  const lista = [{ status: "cancelled" }, { status: "requested" }, { status: "cancelled" }];
  assert.deepEqual(contarSolicitudes(lista), { solicitudes: 3, pendientes: 1 });
});

test("contarSolicitudes: un estado desconocido no cuenta como pendiente", () => {
  const lista = [{ status: "confirmed" }, { status: "requested" }];
  assert.deepEqual(contarSolicitudes(lista), { solicitudes: 2, pendientes: 1 });
});

// resolverReporte

test("resolverReporte: sin sesión de demostración no hay reporte", () => {
  assert.equal(resolverReporte(null, CASOS, ETAPAS, "recomendaciones").tipo, "sin-reporte");
});

test("resolverReporte: un caso desconocido no genera reporte", () => {
  const sesion = { casoId: "caso-inventado", etapa: "reporte", fechaISO: FECHA };
  assert.equal(resolverReporte(sesion, CASOS, ETAPAS, "recomendaciones").tipo, "sin-reporte");
});

test("resolverReporte: antes de llegar a las recomendaciones no hay reporte", () => {
  for (const etapa of ["seleccion", "revision", "preparacion", "resultado"]) {
    const sesion = { casoId: IDS[0], etapa, fechaISO: FECHA };
    assert.equal(resolverReporte(sesion, CASOS, ETAPAS, "recomendaciones").tipo, "sin-reporte", etapa);
  }
});

test("resolverReporte: una etapa desconocida no genera reporte", () => {
  const sesion = { casoId: IDS[0], etapa: "etapa-inventada", fechaISO: FECHA };
  assert.equal(resolverReporte(sesion, CASOS, ETAPAS, "recomendaciones").tipo, "sin-reporte");
});

test("resolverReporte: desde las recomendaciones devuelve las del caso, sin alterarlas", () => {
  for (const etapa of ["recomendaciones", "reporte", "orientacion", "final"]) {
    const sesion = { casoId: CASOS[0].id, etapa, fechaISO: FECHA };
    const r = resolverReporte(sesion, CASOS, ETAPAS, "recomendaciones");
    assert.equal(r.tipo, "con-reporte", etapa);
    assert.equal(r.titulo, CASOS[0].titulo);
    assert.deepEqual(r.recomendaciones, CASOS[0].recomendaciones);
  }
});

test("resolverReporte: el reporte no incluye datos de cuenta", () => {
  const sesion = { casoId: CASOS[0].id, etapa: "reporte", fechaISO: FECHA };
  const r = resolverReporte(sesion, CASOS, ETAPAS, "recomendaciones");
  assert.deepEqual(Object.keys(r).sort(), ["fechaISO", "recomendaciones", "tipo", "titulo"]);
});