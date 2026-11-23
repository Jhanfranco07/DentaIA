import { describe, expect, it } from "vitest";
import { progresoHistorial } from "./modelo";
import type { PlanCatalogo } from "./contrato";

const plan: PlanCatalogo = {
  id: "plan-general", plan_key: "general-preventive", version: 1,
  valid_from: "2026-01-01", valid_until: null,
  activities: [
    { id: "a", activity_key: "cepillado-manana", title: "Mañana", description: "", time_of_day: "morning", sort_order: 1 },
    { id: "b", activity_key: "limpieza-interdental", title: "Hilo", description: "", time_of_day: "daytime", sort_order: 2 },
    { id: "c", activity_key: "cepillado-noche", title: "Noche", description: "", time_of_day: "evening", sort_order: 3 },
  ],
};

describe("Rutinas: historial y cambios de plan", () => {
  it("usa solo actividades elegidas durante la vigencia de la propuesta", () => {
    const marcas = [
      { plan_id: plan.id, activity_id: "a", completion_date: "2026-11-20" },
      { plan_id: plan.id, activity_id: "c", completion_date: "2026-11-20" },
    ];
    const asignaciones = [{ planId: plan.id, actividadIds: ["a","b"],
      aceptadaEn: "2026-11-19T12:00:00Z", revocadaEn: "2026-11-21T12:00:00Z" }];
    const [dia] = progresoHistorial([plan], marcas, asignaciones);
    expect(dia.progreso).toEqual({ completadas: 1, total: 2, porcentaje: 50 });
  });
  it("conserva el plan general antes de la aceptación", () => {
    const marcas = [{ plan_id: plan.id, activity_id: "a", completion_date: "2026-11-18" }];
    const asignaciones = [{ planId: plan.id, actividadIds: ["a"],
      aceptadaEn: "2026-11-19T12:00:00Z", revocadaEn: null }];
    expect(progresoHistorial([plan], marcas, asignaciones)[0].progreso?.total).toBe(3);
  });
  it("no mezcla actividades de planes distintos ni incrementa artificialmente el avance", () => {
    const marcas = [
      { plan_id: plan.id, activity_id: "a", completion_date: "2026-11-18" },
      { plan_id: "otro-plan", activity_id: "invalida", completion_date: "2026-11-18" },
    ];
    expect(progresoHistorial([plan], marcas)[0].progreso).toEqual({ completadas:1, total:3, porcentaje:33 });
  });
  it("no inventa el denominador si falta la versión publicada", () => {
    const marcas = [{ plan_id: "desconocido", activity_id:"x", completion_date:"2026-11-18" }];
    expect(progresoHistorial([plan],marcas)[0].progreso).toBeNull();
  });
});
