import type { EstadoDiaRutina } from "@/features/rutinas/datos";

export type AvisoDenti = { titulo: string; texto: string; href?: string; accion?: string; clave: string };

export function saludoDenti(hora: number): string {
  return hora < 12 ? "¡Buenos días!" : hora < 19 ? "¡Buenas tardes!" : "¡Buenas noches!";
}

/** Solo datos verificados de la rutina del paciente; jamás suponemos cumplimiento. */
export function avisoRutinaDenti(hora: number, fecha: string, estado: EstadoDiaRutina | null): AvisoDenti {
  const saludo = saludoDenti(hora);
  if (!estado?.plan || !estado.actividades.length) return {
    titulo: saludo, texto: "Soy Denti. ¿Te ayudo a encontrar una guía o resolver una duda?",
    clave: `saludo:${fecha}`,
  };
  const realizadas = estado.actividades.filter(a => estado.completadas.includes(a.id)).length;
  const total = estado.actividades.length;
  if (realizadas === total) return {
    titulo: "¡Rutina completada! ✨",
    texto: `Hoy registraste las ${total} actividades de tu rutina. ¡Buen trabajo!`,
    href: "/paciente/rutinas", accion: "Ver progreso",
    clave: `completa:${fecha}:${realizadas}`,
  };
  const pendientes = total - realizadas;
  const momento = hora < 12 ? "morning" : hora < 18 ? "daytime" : "evening";
  const sugerida = estado.actividades.find(a => a.time_of_day === momento && !estado.completadas.includes(a.id))
    ?? estado.actividades.find(a => !estado.completadas.includes(a.id));
  return {
    titulo: saludo,
    texto: realizadas === 0
      ? `Tienes ${pendientes} actividades en tu rutina de hoy.${sugerida ? ` Puedes empezar con «${sugerida.title}».` : ""}`
      : `Llevas ${realizadas} de ${total} actividades. Te quedan ${pendientes} por registrar.`,
    href: "/paciente/rutinas", accion: "Ver mi rutina",
    clave: `pendientes:${fecha}:${realizadas}`,
  };
}
