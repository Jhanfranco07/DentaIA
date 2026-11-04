/** Lógica pura del panel del paciente. Sin dependencias, para probarla sin red ni navegador. */

export type SolicitudBasica = { status: string };

export function contarSolicitudes(solicitudes: readonly SolicitudBasica[]) {
  return {
    solicitudes: solicitudes.length,
    pendientes: solicitudes.filter((s) => s.status === "requested").length,
  };
}

export type CasoReporte = { id: string; titulo: string; recomendaciones: readonly string[] };
export type SesionReporte = { casoId: string; etapa: string; fechaISO: string };

export type ResultadoReporte =
  | { tipo: "sin-reporte" }
  | { tipo: "con-reporte"; titulo: string; fechaISO: string; recomendaciones: readonly string[] };

export function resolverReporte(
  sesion: SesionReporte | null,
  casos: readonly CasoReporte[],
  etapas: readonly string[],
  etapaMinima: string,
): ResultadoReporte {
  if (!sesion) return { tipo: "sin-reporte" };
  const caso = casos.find((c) => c.id === sesion.casoId);
  const posicion = etapas.indexOf(sesion.etapa);
  const minima = etapas.indexOf(etapaMinima);
  if (!caso || posicion < 0 || minima < 0 || posicion < minima) return { tipo: "sin-reporte" };
  return {
    tipo: "con-reporte",
    titulo: caso.titulo,
    fechaISO: sesion.fechaISO,
    recomendaciones: caso.recomendaciones,
  };
}