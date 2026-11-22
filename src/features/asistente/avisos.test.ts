import { describe, expect, it } from "vitest";
import { avisoRutinaDenti, saludoDenti } from "./avisos";
import type { EstadoDiaRutina } from "@/features/rutinas/datos";

const fecha = "2026-11-22";
function estado(completadas: string[]): EstadoDiaRutina {
  return {
    plan: { id: "plan-1", title: "Rutina preventiva" } as EstadoDiaRutina["plan"],
    actividades: [
      { id: "a", title: "Cepillado matutino", time_of_day: "morning" },
      { id: "b", title: "Hilo dental", time_of_day: "evening" },
    ] as EstadoDiaRutina["actividades"],
    completadas,
  };
}
describe("Denti — avisos proactivos basados en datos reales", () => {
  it("saluda según la hora local", () => {
    expect(saludoDenti(8)).toBe("¡Buenos días!");
    expect(saludoDenti(15)).toBe("¡Buenas tardes!");
    expect(saludoDenti(21)).toBe("¡Buenas noches!");
  });
  it("sin plan cargado no inventa tareas", () => {
    const aviso = avisoRutinaDenti(9, fecha, null);
    expect(aviso.texto).not.toContain("actividades");
    expect(aviso.href).toBeUndefined();
  });
  it("muestra progreso verificado y ruta correcta", () => {
    const aviso = avisoRutinaDenti(8, fecha, estado(["a"]));
    expect(aviso.texto).toContain("1 de 2");
    expect(aviso.href).toBe("/paciente/rutinas");
  });
  it("solo felicita al marcar todas las actividades", () => {
    expect(avisoRutinaDenti(20, fecha, estado(["a"])).titulo).not.toContain("completada");
    const aviso = avisoRutinaDenti(20, fecha, estado(["a", "b"]));
    expect(aviso.titulo).toContain("completada");
    expect(aviso.texto).toContain("2 actividades");
  });
});
