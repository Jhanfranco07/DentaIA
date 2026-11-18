import { describe, expect, it } from "vitest";
import { CLAVE_TEMA, guardarTema, leerTema, temaDesdeEvento } from "./preferencia";

function almacen(datos: Record<string, string> = {}) {
  return {
    getItem: (clave: string) => datos[clave] ?? null,
    setItem: (clave: string, valor: string) => { datos[clave] = valor; },
  };
}

describe("Preferencia compartida de apariencia", () => {
  it("inicia en claro sin preferencia previa", () => expect(leerTema(almacen())).toBe("claro"));
  it("recuerda el oscuro elegido explícitamente", () => {
    const storage = almacen();
    guardarTema(storage, "oscuro");
    expect(leerTema(storage)).toBe("oscuro");
    guardarTema(storage, "claro");
    expect(leerTema(storage)).toBe("claro");
  });
  it("recupera la elección anterior del paciente", () => expect(leerTema(almacen({ "dentaia-tema-paciente": "oscuro" }))).toBe("oscuro"));
  it("prioriza la elección global sobre la anterior", () => expect(leerTema(almacen({ [CLAVE_TEMA]: "claro", "dentaia-tema-paciente": "oscuro" }))).toBe("claro"));
  it("descarta valores inválidos y vuelve al claro", () => expect(leerTema(almacen({ [CLAVE_TEMA]: "incorrecto", "dentaia-tema-paciente": "oscuro" }))).toBe("claro"));
  it("funciona si el navegador bloquea el almacenamiento", () => {
    const storage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
    expect(leerTema(storage)).toBe("claro");
    expect(() => guardarTema(storage, "oscuro")).not.toThrow();
  });
  it("sincroniza otras pestañas y el borrado de la preferencia", () => {
    expect(temaDesdeEvento("oscuro")).toBe("oscuro");
    expect(temaDesdeEvento("claro")).toBe("claro");
    expect(temaDesdeEvento(null)).toBe("claro");
  });
});
