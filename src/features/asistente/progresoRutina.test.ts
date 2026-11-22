import { describe, expect, it } from "vitest";
import { consultaProgresoRutina, explicarProgresoRutina } from "./progresoRutina";
import type { EstadoDiaRutina } from "@/features/rutinas/datos";

const estado = (completadas: string[]): EstadoDiaRutina => ({
  plan: { id: "plan", title: "Plan general" } as EstadoDiaRutina["plan"],
  actividades: [
    { id: "a", title: "Cepillado de la mañana" },
    { id: "b", title: "Limpieza interdental" },
  ] as EstadoDiaRutina["actividades"],
  completadas,
});

describe("Denti responde sobre rutinas desde Supabase, sin IA", () => {
  it("reconoce preguntas de progreso y no confunde otras consultas", () => {
    expect(consultaProgresoRutina("¿Cómo va mi rutina?")).toBe(true);
    expect(consultaProgresoRutina("¿Qué me falta de mis actividades?")).toBe(true);
    expect(consultaProgresoRutina("¿Ya terminé mi rutina?")).toBe(true);
    expect(consultaProgresoRutina("¿Cómo me cepillo correctamente?")).toBe(false);
    expect(consultaProgresoRutina("¿Por qué mis dientes están amarillos?")).toBe(false);
  });
  it("solo informa actividades realmente registradas", () => {
    expect(explicarProgresoRutina(estado([]))).toContain("0 de 2");
    expect(explicarProgresoRutina(estado(["a"]))).toContain("1 de 2");
    expect(explicarProgresoRutina(estado(["a"]))).toContain("Limpieza interdental");
    expect(explicarProgresoRutina(estado(["a","b"]))).toContain("todas las actividades");
  });
  it("sin plan disponible no inventa cumplimiento", () => {
    const vacio = { plan: null, actividades: [], completadas: [] };
    expect(explicarProgresoRutina(vacio)).toContain("No encontré");
    expect(explicarProgresoRutina(vacio)).not.toContain("completaste");
  });
});
