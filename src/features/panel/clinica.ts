/** Adaptador de lectura del panel a los BFF existentes. Sin SDK privilegiado ni escrituras. */
export type ClinicaPropia = { autorizaciones: { id: string; estado: "vigente" | "vencido" | "revocado"; vence: string }[];
  atenciones: { id: string; fecha: string; clinica: string }[]; hayMas: boolean };
export class ErrorClinicaPanel extends Error { status: number; constructor(status: number) { super("Lectura clínica no disponible."); this.status = status; } }
const objeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const uuid = (x: unknown): x is string => typeof x === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const fecha = (x: unknown): x is string => typeof x === "string" && Number.isFinite(Date.parse(x));
const invalido = (): never => { throw new ErrorClinicaPanel(502); };
export async function leerClinicaPropia(token: string | null, solicitar: typeof fetch = fetch, signal?: AbortSignal): Promise<ClinicaPropia> {
  if (!token) throw new ErrorClinicaPanel(401);
  const get = async (path: string) => {
    try {
      const r = await solicitar(path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", credentials: "omit", redirect: "error",
        signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]) });
      if (!r.ok) throw new ErrorClinicaPanel(r.status);
      if (!r.headers.get("content-type")?.includes("application/json")) return invalido();
      const body: unknown = await r.json();
      if (!objeto(body) || body.ok !== true || !["academic_remote", "qa_local"].includes(String(body.environment))) return invalido();
      return body;
    } catch (e) { throw e instanceof ErrorClinicaPanel ? e : new ErrorClinicaPanel(503); }
  };
  const me = await get("/api/clinical/patients/me");
  if (me.kind !== "patient" || me.apiVersion !== "clinical.workspace.v1" || !objeto(me.data) || !uuid(me.data.patientId)) return invalido();
  const patientId = me.data.patientId;
  const [grants, history] = await Promise.all([get("/api/clinical/access-grants?limit=50"), get(`/api/clinical/patients/${patientId}/history?limit=50`)]);
  if (grants.environment !== me.environment || history.environment !== me.environment || grants.kind !== "grants" || grants.apiVersion !== "clinical.workspace.v1"
    || !objeto(grants.data) || grants.data.patientId !== patientId || !Array.isArray(grants.data.items) || grants.data.items.length > 50
    || history.apiVersion !== "clinical.v1" || history.origen !== "supabase" || !objeto(history.caso) || history.caso.patientId !== patientId
    || !Array.isArray(history.entries) || history.entries.length > 50
    || (grants.nextAfterId !== null && !uuid(grants.nextAfterId))
    || (history.nextCursor !== null && (typeof history.nextCursor !== "string" || history.nextCursor.length > 4096))) return invalido();
  const autorizaciones = grants.data.items.map(x => {
    if (!objeto(x) || !uuid(x.id) || !["vigente", "vencido", "revocado"].includes(String(x.estado)) || !fecha(x.expiresAt)) return invalido();
    return { id: x.id, estado: x.estado as "vigente" | "vencido" | "revocado", vence: x.expiresAt };
  });
  const atenciones = history.entries.map(x => {
    if (!objeto(x) || !uuid(x.encounterId) || !fecha(x.attendedAt) || !objeto(x.origin) || typeof x.origin.clinicName !== "string" || x.origin.clinicName.length > 200) return invalido();
    return { id: x.encounterId, fecha: x.attendedAt, clinica: x.origin.clinicName };
  });
  if (new Set(autorizaciones.map(x => x.id)).size !== autorizaciones.length || new Set(atenciones.map(x => x.id)).size !== atenciones.length) return invalido();
  return { autorizaciones, atenciones, hayMas: grants.nextAfterId !== null || history.nextCursor !== null };
}
