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
