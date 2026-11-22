import { describe, expect, it } from "vitest";
import { claveVentanaAviso, HORARIO_PREDETERMINADO, horarioValido, momentoAviso, normalizarHorario } from "./configuracionAvisos";

describe("Rutinas: horarios de avisos educativos en la aplicación", () => {
  it("valida formato de hora sin aceptar valores arbitrarios", () => {
    expect(horarioValido("08:00")).toBe(true);
    expect(horarioValido("23:59")).toBe(true);
    for (const invalida of ["24:00", "9:00", "99:99", "texto", ""]) {
      expect(horarioValido(invalida)).toBe(false);
    }
  });
  it("utiliza valores predeterminados para configuraciones corruptas", () => {
    expect(normalizarHorario(null)).toEqual(HORARIO_PREDETERMINADO);
    expect(normalizarHorario({ manana: "56:21", frecuencia: "cualquier" })).toEqual(HORARIO_PREDETERMINADO);
  });
  it("respeta el inicio de cada momento sin anticipar avisos", () => {
    expect(momentoAviso("07:59", HORARIO_PREDETERMINADO)).toBeNull();
    expect(momentoAviso("08:00", HORARIO_PREDETERMINADO)).toBe("manana");
    expect(momentoAviso("12:59", HORARIO_PREDETERMINADO)).toBe("manana");
    expect(momentoAviso("13:00", HORARIO_PREDETERMINADO)).toBe("tarde");
    expect(momentoAviso("20:00", HORARIO_PREDETERMINADO)).toBe("noche");
  });
  it("limita avisos según frecuencia y deja una felicitación única", () => {
    const fecha = "2026-11-22";
    expect(claveVentanaAviso(fecha, HORARIO_PREDETERMINADO, "manana", false))
      .not.toBe(claveVentanaAviso(fecha, HORARIO_PREDETERMINADO, "tarde", false));
    const unaVez = { ...HORARIO_PREDETERMINADO, frecuencia: "una_vez" as const };
    expect(claveVentanaAviso(fecha, unaVez, "manana", false))
      .toBe(claveVentanaAviso(fecha, unaVez, "tarde", false));
    expect(claveVentanaAviso(fecha, unaVez, "tarde", true))
      .toBe(claveVentanaAviso(fecha, unaVez, "noche", true));
  });
});
