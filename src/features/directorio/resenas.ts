export type ResenaPublica = { id: string; dentist_id: string; rating: number; comment: string; created_at: string };
export type CriterioResena = "recientes" | "mejor-calificadas";

export function resumirResenas(resenas: readonly Pick<ResenaPublica, "rating">[]) {
  const validas = resenas.filter(({ rating }) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  if (validas.length === 0) return { total: 0, promedio: null, distribucion: [0, 0, 0, 0, 0] as const };
  const distribucion = [1, 2, 3, 4, 5].map(valor => validas.filter(resena => resena.rating === valor).length);
  return { total: validas.length, promedio: validas.reduce((total, resena) => total + resena.rating, 0) / validas.length, distribucion };
}

export function ordenarResenas(resenas: readonly ResenaPublica[], criterio: CriterioResena): ResenaPublica[] {
  return [...resenas].sort((a, b) => criterio === "mejor-calificadas"
    ? b.rating - a.rating || Date.parse(b.created_at) - Date.parse(a.created_at)
    : Date.parse(b.created_at) - Date.parse(a.created_at) || b.rating - a.rating);
}

export function esInteraccionElegible(interaccion: { is_demo: boolean; status: string }): boolean {
  return interaccion.is_demo === false && interaccion.status === "completed";
}

export function fechaResena(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return Number.isNaN(fecha.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(fecha);
}
