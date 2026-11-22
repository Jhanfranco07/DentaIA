import { describe, expect, it } from "vitest";
import { detectarDestinoDenti, responderOrientacion } from "./motor";

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
    expect(respuesta.texto).toContain("no significa necesariamente caries");
    expect(respuesta.texto).toContain("cepíllate dos veces al día");
  });
  it("explica el cuidado bucal directamente sin obligar a leer una guía", () => {
    const respuesta = responderOrientacion("¿Cómo puedo mejorar mi rutina de cepillado?");
    expect(respuesta.texto).toContain("dos minutos");
    expect(respuesta.texto).toContain("dos veces al día");
    expect(respuesta.texto).not.toMatch(/leer (una|la) guía/i);
    expect(respuesta.guias).toContain("cepillado");
  });
  it("explica la limpieza interdental paso a paso", () => {
    const respuesta = responderOrientacion("¿Cómo uso el hilo dental?");
    expect(respuesta.texto).toContain("forma de C");
    expect(respuesta.texto).toContain("una vez al día");
  });
  it("no desvía un tema de pagos hacia orientación clínica", () => {
    expect(responderOrientacion("¿Dónde veo Premium?").enlaces[0].href).toBe("/premium");
  });
});

describe("Denti — navegación con aprobación", () => {
  it("propone la guía publicada sin inventar ruta", () => {
    expect(detectarDestinoDenti("¿Cómo me cepillo mejor?")).toEqual({
      tipo: "guia", titulo: "Cepillado correcto", href: "/buenas-practicas?guia=cepillado",
    });
    expect(detectarDestinoDenti("¿Cómo uso el hilo dental?")?.href).toBe("/buenas-practicas?guia=hilo");
  });
  it("reconoce módulos reales y conserva preguntas generales en chat", () => {
    expect(detectarDestinoDenti("Quiero preparar una fotografía dental")?.href).toBe("/analisis");
    expect(detectarDestinoDenti("Quiero registrar mi rutina")?.href).toBe("/paciente/rutinas");
    expect(detectarDestinoDenti("¿Por qué mis dientes están amarillos?")).toBeNull();
    expect(detectarDestinoDenti("¿Qué significa sensibilidad dental?")).toBeNull();
  });
  it("nunca retrasa una urgencia proponiendo una guía", () => {
    expect(detectarDestinoDenti("Tengo dolor insoportable y quiero la guía de cepillado")).toBeNull();
    expect(detectarDestinoDenti("Tengo hinchazón en el cuello y dificultad para respirar")).toBeNull();
  });
});
