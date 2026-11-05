import { distanciaEnKm, type PuntoGeografico } from "./geolocalizacion.ts";
import type { DentistaDirectorio, MarcadorConsultorio, UbicacionPublica } from "./tipos";

export function ubicacionMasCercana(ubicaciones: readonly UbicacionPublica[], origen: PuntoGeografico | null) {
  const puntos = ubicaciones.map(ubicacion => ({ ubicacion, distancia: origen ? distanciaEnKm(origen, ubicacion) : null }));
  puntos.sort((a, b) => (a.distancia ?? Number.POSITIVE_INFINITY) - (b.distancia ?? Number.POSITIVE_INFINITY));
  return puntos[0] ?? null;
}

export function tieneUbicacionDentroDelRadio(
  ubicaciones: readonly UbicacionPublica[], origen: PuntoGeografico, radioKm: number,
): boolean {
  if (!Number.isFinite(radioKm) || radioKm <= 0) return true;
  return ubicaciones.some(ubicacion => {
    const distancia = distanciaEnKm(origen, ubicacion);
    return distancia !== null && distancia <= radioKm;
  });
}

export function crearMarcadores(dentistas: readonly DentistaDirectorio[]): MarcadorConsultorio[] {
  return dentistas.flatMap(dentista => dentista.ubicaciones.map(ubicacion => ({
    ...ubicacion,
    dentista: { id: dentista.id, name: dentista.name, is_demo: dentista.is_demo },
  })));
}
