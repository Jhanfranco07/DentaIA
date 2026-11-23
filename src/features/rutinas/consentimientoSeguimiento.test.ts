import { describe, expect, it } from "vitest";
import { puedeOperarSeguimiento, planAsignadoActivo, type ContextoSeguimiento } from "./consentimientoSeguimiento";

const base: ContextoSeguimiento = {
  pacienteId: "paciente-a", titularPacienteId: "paciente-a",
  profesionalId: "odontologo-a", profesionalVerificado: true,
  membresiaActiva: true, autorizacionVigente: true,
  consentimiento: "aprobado", propuesta: "propuesta",
  versionCatalogoPublicada: true,
};
describe("Asignación profesional de rutinas: denegación por defecto", () => {
  it("no permite que otro paciente decida sobre un plan ajeno", () => {
    expect(puedeOperarSeguimiento("paciente", "paciente-b", "aceptar_plan", base)).toBe(false);
    expect(puedeOperarSeguimiento("paciente", "paciente-a", "aceptar_plan", base)).toBe(true);
  });
  it("no permite propuestas sin consentimiento o acceso vigente", () => {
    for (const cambio of [
      { consentimiento: "revocado" as const },
      { autorizacionVigente: false },
      { membresiaActiva: false },
      { profesionalVerificado: false },
      { versionCatalogoPublicada: false },
    ]) {
      expect(puedeOperarSeguimiento("odontologo", "odontologo-a", "proponer_plan", { ...base, ...cambio })).toBe(false);
    }
    expect(puedeOperarSeguimiento("odontologo", "odontologo-b", "proponer_plan", base)).toBe(false);
  });
  it("no interpreta una propuesta como un plan aceptado", () => {
    expect(planAsignadoActivo(base)).toBe(false);
    expect(planAsignadoActivo({ ...base, propuesta: "aceptada" })).toBe(true);
    expect(planAsignadoActivo({ ...base, propuesta: "aceptada", consentimiento: "revocado" })).toBe(false);
  });
  it("separa la aprobación del seguimiento de la aceptación del plan", () => {
    expect(puedeOperarSeguimiento("paciente", "paciente-a", "aprobar_seguimiento", { ...base, consentimiento: "pendiente" })).toBe(true);
    expect(puedeOperarSeguimiento("odontologo", "odontologo-a", "aprobar_seguimiento", { ...base, consentimiento: "pendiente" })).toBe(false);
    expect(puedeOperarSeguimiento("paciente", "paciente-a", "revocar_seguimiento", base)).toBe(true);
    expect(puedeOperarSeguimiento("paciente", "paciente-a", "revocar_plan", { ...base, propuesta: "aceptada" })).toBe(true);
    expect(puedeOperarSeguimiento("odontologo", "odontologo-a", "revocar_plan", { ...base, propuesta: "aceptada" })).toBe(false);
  });
});
