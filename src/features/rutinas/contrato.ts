export type ActividadCatalogo = {
  activity_key: string;
  title: string;
  description: string;
  time_of_day: "morning" | "daytime" | "evening";
  sort_order: number;
};

export type PlanCatalogo = {
  id: string;
  plan_key: string;
  version: number;
  valid_from: string;
  valid_until: string | null;
  activities: readonly ActividadCatalogo[];
};

export type PlanRutina = {
  origen: "general" | "personalizado";
  clave: string;
  version: string;
  fecha: string;
  actividades: readonly ActividadCatalogo[];
};

/** Los proveedores solo seleccionan actividades estables ya presentes en el catálogo validado. */
export interface ProveedorPlanesRutina {
  obtenerPlan(fecha: string, catalogo: readonly PlanCatalogo[]): PlanRutina | null;
}

export function validarPlanRutina(
  plan: PlanRutina,
  catalogo: readonly PlanCatalogo[],
  fecha: string,
): boolean {
  if (!plan || !["general", "personalizado"].includes(plan.origen)
    || typeof plan.clave !== "string" || !plan.clave.trim()
    || typeof plan.version !== "string" || !plan.version.trim()
    || plan.fecha !== fecha || !Array.isArray(plan.actividades) || !plan.actividades.length) return false;
  const versionCatalogo = catalogo.find(item => item.plan_key === plan.clave && `${item.version}` === plan.version
    && item.valid_from <= fecha && (!item.valid_until || item.valid_until >= fecha));
  if (!versionCatalogo) return false;
  const permitidas = new Set(versionCatalogo.activities.map(actividad => actividad.activity_key));
  const recibidas = new Set<string>();
  return plan.actividades.every(actividad => permitidas.has(actividad.activity_key)
    && !recibidas.has(actividad.activity_key) && !!recibidas.add(actividad.activity_key));
}

export const proveedorGeneralRutinas: ProveedorPlanesRutina = {
  obtenerPlan(fecha, catalogo) {
    const plan = [...catalogo]
      .filter(item => item.plan_key === "general-preventive" && item.valid_from <= fecha
        && (!item.valid_until || item.valid_until >= fecha))
      .sort((a, b) => b.version - a.version)[0];
    if (!plan) return null;
    return {
      origen: "general",
      clave: plan.plan_key,
      version: `${plan.version}`,
      fecha,
      actividades: [...plan.activities].sort((a, b) => a.sort_order - b.sort_order),
    };
  },
};
