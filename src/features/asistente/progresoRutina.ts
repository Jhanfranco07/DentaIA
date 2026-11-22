import type { EstadoDiaRutina } from "@/features/rutinas/datos";

export function consultaProgresoRutina(texto: string): boolean {
  const pregunta = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tema = /\b(mi rutina|mis rutinas|mis actividades|actividades de hoy|rutina de hoy)\b/.test(pregunta);
  const accion = /\b(cuanto|avance|progreso|que|como|falt|pendient|toca|complet|termin|hech|realiz|registr|hoy|estado|ver)\w*/.test(pregunta);
  return tema && accion;
}

export function explicarProgresoRutina(estado: EstadoDiaRutina): string {
  if (!estado.plan || !estado.actividades.length) return "No encontré una rutina publicada para hoy. Puedes revisar Mis rutinas e intentarlo de nuevo.";
  const hechas = estado.actividades.filter(a => estado.completadas.includes(a.id));
  const pendientes = estado.actividades.filter(a => !estado.completadas.includes(a.id));
  if (!pendientes.length) return `¡Muy bien! Hoy registraste todas las actividades de tu rutina (${hechas.length} de ${estado.actividades.length}). Puedes ver el historial en Mis rutinas.`;
  const siguiente = pendientes[0];
  return `Hoy llevas ${hechas.length} de ${estado.actividades.length} actividades registradas. Te faltan ${pendientes.length}. ${siguiente ? `La siguiente pendiente es «${siguiente.title}».` : ""} Puedes abrir Mis rutinas para marcarlas cuando las hayas realizado.`;
}
