import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "../../lib/supabase/database.types";
import { rolesDelUsuario } from "../autorizacion/roles.ts";
import { proveedorGeneralRutinas, type ActividadCatalogo, type PlanCatalogo } from "./contrato.ts";
import { fechaHoyLima, type IntervaloAsignacion, type MarcaRutina } from "./modelo.ts";

type Cliente = SupabaseClient<Database>;
type FilaPlan = Tables<"oral_care_routine_plans">;
type FilaActividad = Tables<"oral_care_routine_activities">;
type FilaMarca = Tables<"patient_routine_completions">;

export type EstadoDiaRutina = {
  plan: FilaPlan | null;
  actividades: FilaActividad[];
  completadas: string[];
  origen?: "general" | "personalizado";
};

const seguimientoHabilitado = process.env.NEXT_PUBLIC_DENTAIA_SEGUIMIENTO_RUTINAS === "true";
type Asignacion = { planId: string; propuestaId: string; actividades: string[] };
async function leerAsignacionAprobada(cliente: Cliente): Promise<Asignacion | null> {
  if (!seguimientoHabilitado) return null;
  const { data, error } = await cliente.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sesión de rutinas no disponible.");
  const response = await fetch("/api/rutinas/seguimiento", {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("No se pudo validar la rutina asignada.");
  const cuerpo: unknown = await response.json();
  if (!cuerpo || typeof cuerpo !== "object" || !("tipo" in cuerpo)
      || cuerpo.tipo !== "paciente" || !("planActivo" in cuerpo)) {
    throw new Error("Respuesta de seguimiento incompatible.");
  }
  const plan = cuerpo.planActivo;
  if (plan === null) return null;
  if (!plan || typeof plan !== "object"
    || !("planId" in plan) || typeof plan.planId !== "string"
    || !("propuestaId" in plan) || typeof plan.propuestaId !== "string"
    || !("actividades" in plan) || !Array.isArray(plan.actividades)
    || plan.actividades.length < 1 || plan.actividades.length > 20
    || !plan.actividades.every((id: unknown) => typeof id === "string")
    || new Set(plan.actividades).size !== plan.actividades.length) {
    throw new Error("La selección de actividades no es válida.");
  }
  return plan as Asignacion;
}

async function validarPaciente(cliente: Cliente, usuarioId: string) {
  if (!usuarioId.trim()) throw new Error("Inicia sesión para acceder a tus rutinas.");
  const { data, error } = await cliente.auth.getUser();
  if (error || !data.user || data.user.id !== usuarioId) throw new Error("Tu sesión no es válida.");
  if (!rolesDelUsuario(data.user).includes("paciente")) throw new Error("Tu cuenta no tiene el rol paciente.");
  return data.user.id;
}

async function leerCatalogo(cliente: Cliente): Promise<{ planes: FilaPlan[]; catalogo: PlanCatalogo[] }> {
  const [respuestaPlanes, respuestaActividades] = await Promise.all([
    cliente.from("oral_care_routine_plans").select("*").eq("published", true).order("valid_from", { ascending: false }),
    cliente.from("oral_care_routine_activities").select("*").order("sort_order"),
  ]);
  if (respuestaPlanes.error) throw respuestaPlanes.error;
  if (respuestaActividades.error) throw respuestaActividades.error;
  const planes = respuestaPlanes.data ?? [];
  const actividades = respuestaActividades.data ?? [];
  return {
    planes,
    catalogo: planes.map(plan => ({
      id: plan.id,
      plan_key: plan.plan_key,
      version: plan.version,
      valid_from: plan.valid_from,
      valid_until: plan.valid_until,
      activities: actividades.filter(actividad => actividad.plan_id === plan.id) as ActividadCatalogo[],
    })),
  };
}

export async function leerRutinaDelDia(cliente: Cliente, usuarioId: string, fecha: string): Promise<EstadoDiaRutina> {
  const actor = await validarPaciente(cliente, usuarioId);
  const { planes, catalogo } = await leerCatalogo(cliente);
  const propuesta = proveedorGeneralRutinas.obtenerPlan(fecha, catalogo);
  const asignacion = fecha === fechaHoyLima() ? await leerAsignacionAprobada(cliente) : null;
  const seleccion = asignacion
    ? planes.find(plan => plan.id === asignacion.planId
      && plan.valid_from <= fecha && (!plan.valid_until || plan.valid_until >= fecha))
    : propuesta && planes.find(plan => plan.plan_key === propuesta.clave && `${plan.version}` === propuesta.version);
  if (!seleccion) {
    if (asignacion) throw new Error("La versión asignada ya no está publicada.");
    return { plan: null, actividades: [], completadas: [] };
  }
  const { data, error } = await cliente.from("oral_care_routine_activities").select("*")
    .eq("plan_id", seleccion.id).order("time_of_day").order("sort_order");
  if (error) throw error;
  const actividades = data ?? [];
  if (asignacion && asignacion.actividades.some(id => !actividades.some(a => a.id === id)))
    throw new Error("La propuesta contiene actividades no disponibles.");
  const visibles = asignacion
    ? actividades.filter(a => asignacion.actividades.includes(a.id))
    : actividades;
  const marcas = await cliente.from("patient_routine_completions").select("activity_id")
    .eq("patient_id", actor).eq("completion_date", fecha).eq("plan_id", seleccion.id);
  if (marcas.error) throw marcas.error;
  return { plan: seleccion, actividades: visibles, completadas: (marcas.data ?? []).map(marca => marca.activity_id), origen: asignacion ? "personalizado" : "general" };
}

async function leerIntervalosAsignacion(cliente: Cliente): Promise<IntervaloAsignacion[]> {
  if (!seguimientoHabilitado) return [];
  const { data, error } = await cliente.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sesión de historial no disponible.");
  const response = await fetch("/api/rutinas/seguimiento", {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("No se pudo leer la versión de tus planes.");
  const cuerpo: unknown = await response.json();
  if (!cuerpo || typeof cuerpo !== "object" || !("tipo" in cuerpo)
      || cuerpo.tipo !== "paciente" || !("propuestas" in cuerpo) || !Array.isArray(cuerpo.propuestas)) {
    throw new Error("Historial de propuestas incompatible.");
  }
  const propuestas = cuerpo.propuestas as unknown[];
  return propuestas.flatMap((valor): IntervaloAsignacion[] => {
    if (!valor || typeof valor !== "object") return [];
    const p = valor as Record<string, unknown>;
    if (!["aceptada","revocada"].includes(String(p.estado))
      || typeof p.planId !== "string" || typeof p.aceptadaEn !== "string"
      || (p.revocadaEn !== null && typeof p.revocadaEn !== "string")
      || !Array.isArray(p.actividades)) return [];
    const ids = p.actividades.flatMap((a: unknown) => {
      if (!a || typeof a !== "object" || !("id" in a) || typeof a.id !== "string") return [];
      return [a.id];
    });
    if (!ids.length || ids.length !== p.actividades.length || new Set(ids).size !== ids.length) return [];
    return [{ planId: p.planId, actividadIds: ids, aceptadaEn: p.aceptadaEn,
      revocadaEn: p.revocadaEn as string | null }];
  });
}

export async function leerHistorialRutinas(cliente: Cliente, usuarioId: string): Promise<{
  catalogo: PlanCatalogo[]; marcas: MarcaRutina[]; asignaciones: IntervaloAsignacion[];
}> {
  const actor = await validarPaciente(cliente, usuarioId);
  const [{ catalogo }, marcas, asignaciones] = await Promise.all([
    leerCatalogo(cliente),
    (async () => {
      const resultado: MarcaRutina[] = [];
      const pagina = 500;
      for (let desde = 0; ; desde += pagina) {
        const respuesta = await cliente.from("patient_routine_completions").select("activity_id,plan_id,completion_date")
          .eq("patient_id", actor).order("completion_date", { ascending: false }).range(desde, desde + pagina - 1);
        if (respuesta.error) throw respuesta.error;
        const filas = (respuesta.data ?? []) as MarcaRutina[];
        resultado.push(...filas);
        if (filas.length < pagina) break;
      }
      return resultado;
    })(),
    leerIntervalosAsignacion(cliente),
  ]);
  return { catalogo, marcas, asignaciones };
}

export async function marcarActividadRutina(
  cliente: Cliente, usuarioId: string, planId: string, actividadId: string, completada: boolean,
): Promise<void> {
  const actor = await validarPaciente(cliente, usuarioId);
  const fecha = fechaHoyLima();
  if (completada) {
    const { error } = await cliente.from("patient_routine_completions").upsert({
      plan_id: planId, activity_id: actividadId, completion_date: fecha,
    }, { onConflict: "patient_id,activity_id,completion_date", ignoreDuplicates: true });
    if (error) throw error;
    return;
  }
  const { error } = await cliente.from("patient_routine_completions").delete()
    .eq("patient_id", actor).eq("plan_id", planId).eq("activity_id", actividadId).eq("completion_date", fecha);
  if (error) throw error;
}

export type MarcaPersistida = FilaMarca;
