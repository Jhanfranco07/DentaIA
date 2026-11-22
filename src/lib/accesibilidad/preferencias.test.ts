import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { INICIAR_ACCESIBILIDAD, PREFERENCIAS_INICIALES, alternarPerfil, leerPreferencias, normalizarPreferencias, perfilActivo } from "./preferencias";

describe("preferencias de accesibilidad", () => {
  it("mantiene el aspecto original si no hay preferencias", () => {
    expect(normalizarPreferencias(null)).toEqual(PREFERENCIAS_INICIALES);
    expect(leerPreferencias({ getItem: () => null })).toEqual(PREFERENCIAS_INICIALES);
  });
  it("acepta solo escalas previstas y booleanos reales", () => {
    expect(normalizarPreferencias({ escala: 999, movimiento: "false", contraste: 1 })).toEqual(PREFERENCIAS_INICIALES);
    expect(normalizarPreferencias({ escala: 125, movimiento: true })).toMatchObject({ escala: 125, movimiento: true });
  });
  it("ignora objetos inválidos y datos ajenos a los ajustes", () => {
    expect(normalizarPreferencias([true])).toEqual(PREFERENCIAS_INICIALES);
    expect(normalizarPreferencias({ unknown: "<script>", cursor: true })).not.toHaveProperty("unknown");
  });
  it("tolera almacenamiento bloqueado y JSON incorrecto", () => {
    expect(leerPreferencias({ getItem() { throw new Error("bloqueado"); } })).toEqual(PREFERENCIAS_INICIALES);
    expect(leerPreferencias({ getItem: () => "{" })).toEqual(PREFERENCIAS_INICIALES);
  });
  it("recupera ajustes guardados sin activar otros", () => {
    const p = { ...PREFERENCIAS_INICIALES, escala: 150 as const, mascara: true };
    expect(leerPreferencias({ getItem: () => JSON.stringify(p) })).toEqual(p);
  });
  it("reduce estímulos y conserva los ajustes independientes", () => {
    const p = { ...PREFERENCIAS_INICIALES, fuente: true };
    const activo = alternarPerfil(p, "estimulos");
    expect(perfilActivo(activo, "estimulos")).toBe(true);
    expect(activo.fuente).toBe(true);
    expect(alternarPerfil(activo, "estimulos")).toEqual(p);
  });
  it("baja visión combina escala, contraste y enlaces", () => {
    const p = alternarPerfil(PREFERENCIAS_INICIALES, "vision");
    expect(p).toMatchObject({ escala: 150, contraste: true, enlaces: true });
    expect(perfilActivo(p, "vision")).toBe(true);
    expect(alternarPerfil(p, "vision")).toEqual(PREFERENCIAS_INICIALES);
  });
  it("concentración activa máscara, reduce movimiento y oculta decoración", () => {
    const p = alternarPerfil(PREFERENCIAS_INICIALES, "concentracion");
    expect(p).toMatchObject({ mascara: true, movimiento: true, imagenes: true });
    expect(perfilActivo(p, "concentracion")).toBe(true);
  });
  it("aplica antes de hidratar los mismos valores normalizados", () => {
    const guardado = { escala: 125, movimiento: true, cursor: true, espaciado: "true", extra: "ignorado" };
    const atributos: Record<string, string> = {};
    const propiedades: Record<string, string> = {};
    runInNewContext(INICIAR_ACCESIBILIDAD, {
      localStorage: { getItem: () => JSON.stringify(guardado) },
      document: { documentElement: { setAttribute: (k: string, v: string) => { atributos[k] = v; }, style: { setProperty: (k: string, v: string) => { propiedades[k] = v; } } } },
    });
    for (const [k, v] of Object.entries(normalizarPreferencias(guardado))) {
      if (k !== "escala") expect(atributos[`data-a11y-${k}`]).toBe(String(v));
    }
    expect(propiedades["--a11y-escala"]).toBe("1.25");
    expect(atributos).not.toHaveProperty("data-a11y-extra");
  });
  it("el inicio no bloquea la página si el almacenamiento falla", () => {
    expect(() => runInNewContext(INICIAR_ACCESIBILIDAD, { localStorage: { getItem() { throw new Error("bloqueado"); } } })).not.toThrow();
  });
});
