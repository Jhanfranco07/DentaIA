/**
 * Contrato de autorización de seguimiento de rutinas.
 *
 * Estas validaciones son reglas del dominio, NO reemplazan la autorización
 * de Supabase RLS ni una operación transaccional del servidor.
 */
export type EstadoConsentimiento = "pendiente" | "aprobado" | "revocado";
export type EstadoPropuesta = "propuesta" | "aceptada" | "rechazada" | "revocada";
export type ActorRutina = "paciente" | "odontologo";
export type OperacionRutina =
  | "aprobar_seguimiento"
  | "revocar_seguimiento"
  | "proponer_plan"
  | "aceptar_plan"
  | "rechazar_plan"
  | "revocar_plan";

export type ContextoSeguimiento = {
  pacienteId: string;
  profesionalId: string;
  titularPacienteId: string;
  profesionalVerificado: boolean;
  membresiaActiva: boolean;
  autorizacionVigente: boolean;
  consentimiento: EstadoConsentimiento;
  propuesta?: EstadoPropuesta;
  versionCatalogoPublicada: boolean;
};

export function puedeOperarSeguimiento(
  actor: ActorRutina,
  usuarioId: string,
  operacion: OperacionRutina,
  contexto: ContextoSeguimiento,
): boolean {
  if (!usuarioId || !contexto.pacienteId || contexto.titularPacienteId !== contexto.pacienteId) return false;
  const esPaciente = actor === "paciente" && usuarioId === contexto.titularPacienteId;
  const esProfesional = actor === "odontologo" && usuarioId === contexto.profesionalId;
  if (operacion === "aprobar_seguimiento") return esPaciente && contexto.consentimiento === "pendiente"
    && contexto.profesionalVerificado && contexto.membresiaActiva;
  if (operacion === "revocar_seguimiento") return esPaciente && contexto.consentimiento === "aprobado";
  const accesoVigente = contexto.consentimiento === "aprobado"
    && contexto.autorizacionVigente && contexto.profesionalVerificado && contexto.membresiaActiva;
  if (operacion === "proponer_plan") return esProfesional && accesoVigente && contexto.versionCatalogoPublicada;
  if (operacion === "aceptar_plan" || operacion === "rechazar_plan") {
    return esPaciente && accesoVigente && contexto.propuesta === "propuesta";
  }
  if (operacion === "revocar_plan") return esPaciente && contexto.propuesta === "aceptada";
  return false;
}

/** No se puede activar un plan propuesto sin decisión explícita del paciente. */
export function planAsignadoActivo(contexto: ContextoSeguimiento): boolean {
  return contexto.consentimiento === "aprobado" && contexto.autorizacionVigente
    && contexto.propuesta === "aceptada" && contexto.profesionalVerificado
    && contexto.membresiaActiva && contexto.versionCatalogoPublicada;
}
