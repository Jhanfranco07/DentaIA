/** Validación estricta de solicitudes de seguimiento: ninguna identidad proviene del cuerpo. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esIdentificador = (v: unknown): v is string => typeof v === "string" && uuid.test(v);

export type AccionSeguimiento =
  | "invitar" | "aprobar_seguimiento" | "rechazar_seguimiento"
  | "revocar_seguimiento" | "proponer_plan"
  | "aceptar_plan" | "rechazar_plan" | "revocar_plan";

type Parametros = {
  p_accion: AccionSeguimiento;
  p_membership_id: string | null;
  p_patient_record_id: string | null;
  p_consent_id: string | null;
  p_proposal_id: string | null;
  p_plan_id: string | null;
  p_activity_ids: string[] | null;
};
const campos: Record<AccionSeguimiento, readonly string[]> = {
  invitar: ["membershipId", "patientRecordId"],
  aprobar_seguimiento: ["consentId"],
  rechazar_seguimiento: ["consentId"],
  revocar_seguimiento: ["consentId"],
  proponer_plan: ["consentId", "planId", "activityIds"],
  aceptar_plan: ["proposalId"],
  rechazar_plan: ["proposalId"],
  revocar_plan: ["proposalId"],
};
const accionesPaciente = new Set<AccionSeguimiento>([
  "aprobar_seguimiento", "rechazar_seguimiento",
  "revocar_seguimiento", "aceptar_plan", "rechazar_plan", "revocar_plan",
]);
const accionesProfesional = new Set<AccionSeguimiento>(["invitar", "proponer_plan"]);

export function validarOperacionSeguimiento(
  cuerpo: Record<string, unknown>, roles: readonly string[],
): Parametros | null {
  const accion = cuerpo.accion;
  if (typeof accion !== "string" || !(accion in campos)) return null;
  const a = accion as AccionSeguimiento;
  if (!(accionesPaciente.has(a) && roles.includes("paciente")
      || accionesProfesional.has(a) && roles.includes("odontologo"))) return null;
  const requeridos = campos[a];
  if (Object.keys(cuerpo).length !== requeridos.length + 1
      || !Object.keys(cuerpo).every(k => k === "accion" || requeridos.includes(k))
      || requeridos.some(k => !(k in cuerpo))) return null;
  const ids = ["membershipId", "patientRecordId", "consentId", "proposalId", "planId"] as const;
  if (ids.some(k => cuerpo[k] !== undefined && !esIdentificador(cuerpo[k]))) return null;
  let actividades: string[] | null = null;
  if (a === "proponer_plan") {
    const lista = cuerpo.activityIds;
    if (!Array.isArray(lista) || lista.length < 1 || lista.length > 20
      || !lista.every(esIdentificador) || new Set(lista.map(v => v.toLowerCase())).size !== lista.length) return null;
    actividades = lista.map((v: string) => v.toLowerCase());
  }
  return {
    p_accion: a,
    p_membership_id: cuerpo.membershipId as string ?? null,
    p_patient_record_id: cuerpo.patientRecordId as string ?? null,
    p_consent_id: cuerpo.consentId as string ?? null,
    p_proposal_id: cuerpo.proposalId as string ?? null,
    p_plan_id: cuerpo.planId as string ?? null,
    p_activity_ids: actividades,
  };
}
