import type { PlanCatalogo } from "./contrato";

export type MarcaRutina = { activity_id: string; plan_id: string; completion_date: string };
export type ProgresoRutina = { completadas: number; total: number; porcentaje: number };

export function fechaHoyLima(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find(parte => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function progresoDelDia(total: number, marcas: readonly MarcaRutina[]): ProgresoRutina {
  const completadas = Math.min(Math.max(total, 0), new Set(marcas.map(marca => marca.activity_id)).size);
  return { completadas, total: Math.max(0, total), porcentaje: total > 0 ? Math.round(completadas / total * 100) : 0 };
}

export function progresoHistorial(
  catalogo: readonly PlanCatalogo[],
  marcas: readonly MarcaRutina[],
): { fecha: string; progreso: ProgresoRutina | null }[] {
  const fechas = [...new Set(marcas.map(marca => marca.completion_date))].sort((a, b) => b.localeCompare(a));
  return fechas.map(fecha => {
    const delDia = marcas.filter(marca => marca.completion_date === fecha);
    const planId = delDia[0]?.plan_id;
    const plan = catalogo.find(item => item.id === planId);
    if (!plan) return { fecha, progreso: null };
    return { fecha, progreso: progresoDelDia(plan.activities.length, delDia) };
  });
}

export function agruparMarcasPorDia(marcas: readonly MarcaRutina[]) {
  return marcas.reduce<Record<string, MarcaRutina[]>>((grupos, marca) => {
    (grupos[marca.completion_date] ??= []).push(marca);
    return grupos;
  }, {});
}
