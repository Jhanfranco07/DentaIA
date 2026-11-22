import { describe, expect, it } from "vitest";
import { responderOrientacion } from "./motor";

describe("asistente DentaIA — orientación segura", () => {
  it("incluye guías existentes y enlaces al módulo de rutinas", () => {
    const respuesta = responderOrientacion("Quiero crear una rutina de cepillado");
    expect(respuesta.guias).toContain("cepillado");
    expect(respuesta.enlaces.some(e => e.href === "/paciente/rutinas")).toBe(true);
  });
  it("no interpreta la fotografía como un diagnóstico ni inventa identidades", () => {
    const respuesta = responderOrientacion("Explícame mis resultados", {
      evaluable: true, variacionesColor: 2, posiblesAusencias: 0, posiblesApiñamientos: 1,
    });
    expect(respuesta.texto).toContain("2 regiones");
    expect(respuesta.texto).toContain("no dientes diagnosticados");
    expect(respuesta.especialidad).toBe("ortodoncia");
  });
  it("explica fotografías no evaluables y recomienda repetir la captura", () => {
    const respuesta = responderOrientacion("mis resultados", {
      evaluable: false, variacionesColor: 0, posiblesAusencias: 0, posiblesApiñamientos: 0,
    });
    expect(respuesta.enlaces.some(e => e.href === "/analisis")).toBe(true);
  });
  it("prioriza emergencias y no ofrece autodiagnósticos", () => {
    const respuesta = responderOrientacion("Tengo hinchazón en el cuello y dificultad para respirar");
    expect(respuesta.alerta).toBe(true);
    expect(respuesta.texto).toContain("emergencias");
  });
  it("solo explica precios publicados sin inventar cotizaciones", () => {
    const respuesta = responderOrientacion("¿Qué odontólogos y precios tienen?");
    expect(respuesta.especialidad).toBe("general");
    expect(respuesta.texto).toContain("precios");
    expect(respuesta.texto).toContain("demostración");
  });
  it("orienta a revisión cuando preocupa una mancha amarilla", () => {
    const respuesta = responderOrientacion("Tengo dientes amarillos, ¿es caries?");
    expect(respuesta.guias).toContain("controles");
    expect(respuesta.texto).toContain("no identifica");
  });
  it("no desvía un tema de pagos hacia orientación clínica", () => {
    expect(responderOrientacion("¿Dónde veo Premium?").enlaces[0].href).toBe("/premium");
  });
});
