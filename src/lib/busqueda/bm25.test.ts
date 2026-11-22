import { describe, expect, it } from "vitest";
import { crearIndiceBm25, idf, tokenizar } from "./bm25";

const indice = (textos: string[], ajustes?: { k1: number; b: number }) =>
  crearIndiceBm25(textos, texto => [{ texto, peso: 1 }], ajustes);

describe("BM25", () => {
  it("normaliza Unicode, tildes y puntuación y conserva la eñe", () => {
    expect(tokenizar(" ¡ODONTO\u0301LOGOS,  en Ｌｉｍａ! Peña ")).toEqual(["odontologo", "lima", "peña"]);
    expect(tokenizar("ortodoncistas y odontopediatra")).toEqual(["ortodoncia", "odontopediatria"]);
  });

  it("sube el peso de los términos menos comunes", () => {
    expect(idf(10, 2)).toBeCloseTo(Math.log(1 + (10 - 2 + 0.5) / (2 + 0.5)), 10);
    expect(idf(10, 2)).toBeGreaterThan(idf(10, 9));
  });

  it("premia la frecuencia con saturación y normaliza la longitud", () => {
    const frecuente = "cepillo cepillo dental";
    const sencillo = "cepillo encía dental";
    expect(indice([sencillo, frecuente])("cepillo")).toEqual([frecuente, sencillo]);
    const largo = "hilo dental guía práctica prevención";
    expect(indice([largo, "hilo"])("hilo")).toEqual(["hilo", largo]);
    expect(indice([largo, "hilo"], { k1: 1.2, b: 0 })("hilo")).toEqual([largo, "hilo"]);
  });

  it("combina varios términos, ignora los repetidos y respeta un filtro obligatorio", () => {
    const buscar = indice(["dental limpieza", "blanqueamiento dental", "blanqueamiento ordinario"]);
    expect(buscar("blanqueamiento dental dental")[0]).toBe("blanqueamiento dental");
    expect(buscar("blanqueamiento dental", item => item.endsWith("limpieza"))).toEqual(["dental limpieza"]);
  });

  it("conserva el orden base al limpiar texto y devuelve vacío si faltan términos útiles", () => {
    const buscar = indice(["cepillado", "flúor"]);
    expect(buscar("  ")).toEqual(["cepillado", "flúor"]);
    expect(buscar("el y de")).toEqual([]);
    expect(buscar("sincoincidencia")).toEqual([]);
  });
});
