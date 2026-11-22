import { describe, expect, it } from "vitest";
import { esIdentificador, validarOperacionSeguimiento } from "./validarSeguimiento";
const consentimiento="11111111-1111-4111-8111-111111111111";
const membresia="22222222-2222-4222-8222-222222222222";
const paciente="33333333-3333-4333-8333-333333333333";
const plan="44444444-4444-4444-8444-444444444444";
const actividad="55555555-5555-4555-8555-555555555555";

describe("DI-207: validación de solicitudes del servidor", () => {
  it("solo acepta UUID completos", () => {
    expect(esIdentificador(consentimiento)).toBe(true);
    expect(esIdentificador("../../../admin")).toBe(false);
    expect(esIdentificador("random")).toBe(false);
  });
  it("impide operar sobre roles ajenos", () => {
    expect(validarOperacionSeguimiento({accion:"invitar",membershipId:membresia,patientRecordId:paciente},["paciente"])).toBeNull();
    expect(validarOperacionSeguimiento({accion:"aprobar_seguimiento",consentId:consentimiento},["odontologo"])).toBeNull();
    expect(validarOperacionSeguimiento({accion:"aprobar_seguimiento",consentId:consentimiento},["paciente"])?.p_consent_id).toBe(consentimiento);
  });
  it("rechaza campos extra e identidades autodeclaradas", () => {
    expect(validarOperacionSeguimiento({accion:"aceptar_plan",proposalId:consentimiento,userId:paciente},["paciente"])).toBeNull();
    expect(validarOperacionSeguimiento({accion:"aprobar_seguimiento",consentId:"invalido"},["paciente"])).toBeNull();
  });
  it("solo acepta actividades UUID únicas y cantidades limitadas", () => {
    const base={accion:"proponer_plan",consentId:consentimiento,planId:plan};
    expect(validarOperacionSeguimiento({...base,activityIds:[]},["odontologo"])).toBeNull();
    expect(validarOperacionSeguimiento({...base,activityIds:[actividad,actividad]},["odontologo"])).toBeNull();
    expect(validarOperacionSeguimiento({...base,activityIds:[actividad]},["odontologo"])?.p_activity_ids).toEqual([actividad]);
    expect(validarOperacionSeguimiento({...base,activityIds:Array(21).fill(actividad)},["odontologo"])).toBeNull();
  });
});
