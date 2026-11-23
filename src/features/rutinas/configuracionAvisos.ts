/** Preferencia local por cuenta y navegador. No constituye una alarma en segundo plano. */
export function claveAvisosRutinas(usuarioId: string): string {
  return `dentaia:avisos-rutinas:${usuarioId}`;
}
export function leerPreferenciaAvisos(usuarioId: string): boolean {
  if (typeof window === "undefined" || !usuarioId) return true;
  try { return window.localStorage.getItem(claveAvisosRutinas(usuarioId)) !== "desactivados"; }
  catch { return true; }
}
export function guardarPreferenciaAvisos(usuarioId: string, activo: boolean) {
  if (!usuarioId || typeof window === "undefined") return;
  try { window.localStorage.setItem(claveAvisosRutinas(usuarioId), activo ? "activados" : "desactivados"); }
  catch { /* Preferencia temporal si navegador bloquea almacenamiento. */ }
  window.dispatchEvent(new CustomEvent("dentaia:preferencia-avisos", { detail: { usuarioId, activo } }));
}

/** Horarios locales de Lima. Solo se evalúan cuando el usuario abre DentaIA. */
export type HorarioAvisos = { manana: string; tarde: string; noche: string; frecuencia: "una_vez" | "por_momento" };
export const HORARIO_PREDETERMINADO: HorarioAvisos = { manana: "08:00", tarde: "13:00", noche: "20:00", frecuencia: "por_momento" };
export function horarioValido(valor: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(valor);
}
export function normalizarHorario(valor: unknown): HorarioAvisos {
  if (!valor || typeof valor !== "object") return { ...HORARIO_PREDETERMINADO };
  const config = valor as Record<string, unknown>;
  const horario: HorarioAvisos = {
    manana: typeof config.manana === "string" && horarioValido(config.manana) ? config.manana : HORARIO_PREDETERMINADO.manana,
    tarde: typeof config.tarde === "string" && horarioValido(config.tarde) ? config.tarde : HORARIO_PREDETERMINADO.tarde,
    noche: typeof config.noche === "string" && horarioValido(config.noche) ? config.noche : HORARIO_PREDETERMINADO.noche,
    frecuencia: config.frecuencia === "una_vez" ? "una_vez" : "por_momento",
  };
  // Horarios crecientes: si el usuario introduce un orden inválido se usa el predeterminado.
  if (!(horario.manana < horario.tarde && horario.tarde < horario.noche)) return { ...HORARIO_PREDETERMINADO };
  return horario;
}
export function leerHorarioAvisos(usuarioId: string): HorarioAvisos {
  if (typeof window === "undefined" || !usuarioId) return { ...HORARIO_PREDETERMINADO };
  try { return normalizarHorario(JSON.parse(window.localStorage.getItem(`dentaia:horario-avisos:${usuarioId}`) ?? "null")); }
  catch { return { ...HORARIO_PREDETERMINADO }; }
}
export function guardarHorarioAvisos(usuarioId: string, horario: HorarioAvisos): void {
  if (!usuarioId || typeof window === "undefined") return;
  const valido = normalizarHorario(horario);
  try { window.localStorage.setItem(`dentaia:horario-avisos:${usuarioId}`, JSON.stringify(valido)); }
  catch { /* No se requiere escritura en Supabase. */ }
  window.dispatchEvent(new Event("dentaia:preferencia-avisos"));
}
/** No adelantar recordatorios: cada momento debe llegar a su hora configurada. */
export function momentoAviso(fechaHoraLima: string, horario: HorarioAvisos): "manana" | "tarde" | "noche" | null {
  const hora = fechaHoraLima.slice(0, 5);
  if (!horarioValido(hora)) return null;
  if (hora >= horario.noche) return "noche";
  if (hora >= horario.tarde) return "tarde";
  if (hora >= horario.manana) return "manana";
  return null;
}
export function claveVentanaAviso(fecha: string, horario: HorarioAvisos, momento: string, completada: boolean): string {
  if (completada) return `rutina-completada:${fecha}`;
  return horario.frecuencia === "una_vez" ? `rutina-diaria:${fecha}` : `rutina:${fecha}:${momento}`;
}
