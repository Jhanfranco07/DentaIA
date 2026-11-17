import test from "node:test";
import assert from "node:assert/strict";
import { fechaHoyLima, progresoDelDia, progresoHistorial } from "./modelo.ts";
import { proveedorGeneralRutinas, validarPlanRutina } from "./contrato.ts";

const catalogo = [{ id: "plan-v1", plan_key: "general-preventive", version: 1, valid_from: "2026-01-01", valid_until: "2026-11-16", activities: [
  { activity_key: "brush", title: "Cepillado", description: "General", time_of_day: "morning", sort_order: 1 },
  { activity_key: "floss", title: "Limpieza interdental", description: "General", time_of_day: "daytime", sort_order: 2 },
] }, { id: "plan-v2", plan_key: "general-preventive", version: 2, valid_from: "2026-11-17", valid_until: null, activities: [
  { activity_key: "brush", title: "Cepillado", description: "General", time_of_day: "morning", sort_order: 1 },
  { activity_key: "floss", title: "Limpieza interdental", description: "General", time_of_day: "daytime", sort_order: 2 },
  { activity_key: "night", title: "Cepillado de noche", description: "General", time_of_day: "evening", sort_order: 3 },
] }];

test("America/Lima resuelve el límite de medianoche local con exactitud", () => {
  assert.equal(fechaHoyLima(new Date("2026-11-17T04:59:59.000Z")), "2026-11-16");
  assert.equal(fechaHoyLima(new Date("2026-11-17T05:00:00.000Z")), "2026-11-17");
});

test("el progreso se calcula de marcas únicas persistidas y no inventa porcentaje", () => {
  assert.deepEqual(progresoDelDia(3, [{ activity_id: "a", plan_id: "p", completion_date: "2026-11-16" }, { activity_id: "a", plan_id: "p", completion_date: "2026-11-16" }]), { completadas: 1, total: 3, porcentaje: 33 });
  assert.deepEqual(progresoDelDia(0, []), { completadas: 0, total: 0, porcentaje: 0 });
});

test("el plan general es determinista y la validación rechaza actividades no catalogadas", () => {
  assert.equal(proveedorGeneralRutinas.obtenerPlan("2026-11-16", catalogo).version, "1");
  assert.equal(proveedorGeneralRutinas.obtenerPlan("2026-11-17", catalogo).version, "2");
  const propuesta = proveedorGeneralRutinas.obtenerPlan("2026-11-17", catalogo);
  assert.equal(validarPlanRutina(propuesta, catalogo, "2026-11-17"), true);
  assert.equal(validarPlanRutina({ ...propuesta, actividades: [...propuesta.actividades, propuesta.actividades[0]] }, catalogo, "2026-11-17"), false);
  assert.equal(validarPlanRutina({ ...propuesta, actividades: [{ ...propuesta.actividades[0], activity_key: "hallazgo-clinico" }] }, catalogo, "2026-11-17"), false);
});

test("historial conserva denominador por versión del plan vigente ese día", () => {
  const resultado = progresoHistorial(catalogo, [
    { activity_id: "brush", plan_id: "plan-v1", completion_date: "2026-11-16" },
    { activity_id: "brush", plan_id: "plan-v2", completion_date: "2026-11-17" },
  ]);
  assert.deepEqual(resultado.map(item => [item.fecha, item.progreso.total, item.progreso.porcentaje]), [
    ["2026-11-17", 3, 33], ["2026-11-16", 2, 50],
  ]);
});
