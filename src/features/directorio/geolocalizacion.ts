export type PuntoGeografico = { latitude: number; longitude: number; accuracy?: number };

export function coordenadasValidas(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function distanciaEnKm(origen: PuntoGeografico, destino: PuntoGeografico): number | null {
  if (!coordenadasValidas(origen.latitude, origen.longitude) || !coordenadasValidas(destino.latitude, destino.longitude)) return null;
  const radianes = (grados: number) => grados * Math.PI / 180;
  const diferenciaLatitud = radianes(destino.latitude - origen.latitude);
  const diferenciaLongitud = radianes(destino.longitude - origen.longitude);
  const a = Math.sin(diferenciaLatitud / 2) ** 2
    + Math.cos(radianes(origen.latitude)) * Math.cos(radianes(destino.latitude)) * Math.sin(diferenciaLongitud / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function mensajeErrorUbicacion(codigo: number | "incompatible" | "precision"): string {
  if (codigo === "incompatible") return "Este navegador no permite consultar la ubicación. Puedes elegir un distrito y seguir usando el directorio.";
  if (codigo === "precision") return "La ubicación recibida no tiene precisión suficiente. Elige un distrito o inténtalo desde otro lugar.";
  if (codigo === 1) return "No se concedió permiso para conocer tu ubicación. Puedes elegir un distrito manualmente.";
  if (codigo === 2) return "No pudimos determinar tu ubicación. Comprueba el GPS o elige un distrito.";
  if (codigo === 3) return "La búsqueda de ubicación tardó demasiado. Inténtalo nuevamente o elige un distrito.";
  return "No pudimos obtener tu ubicación. Puedes seguir con la búsqueda por distrito.";
}

export function obtenerUbicacionActual(geolocation: Pick<Geolocation, "getCurrentPosition">): Promise<PuntoGeografico> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!coordenadasValidas(coords.latitude, coords.longitude) || !Number.isFinite(coords.accuracy) || coords.accuracy > 1000) {
          reject(Object.assign(new Error("PRECISION"), { code: "precision" as const }));
          return;
        }
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}

export function filtrarPorRadio<T extends { latitude: number | null; longitude: number | null }>(
  dentistas: readonly T[], origen: PuntoGeografico, radioKm: number,
): T[] {
  if (!Number.isFinite(radioKm) || radioKm <= 0) return [...dentistas];
  return dentistas.filter(dentista => {
    const distancia = distanciaEnKm(origen, { latitude: dentista.latitude ?? NaN, longitude: dentista.longitude ?? NaN });
    return distancia !== null && distancia <= radioKm;
  });
}

export function ordenarPorProximidad<T extends { latitude: number | null; longitude: number | null }>(
  dentistas: readonly T[], origen: PuntoGeografico,
): T[] {
  return [...dentistas].sort((a, b) => {
    const distanciaA = distanciaEnKm(origen, { latitude: a.latitude ?? NaN, longitude: a.longitude ?? NaN });
    const distanciaB = distanciaEnKm(origen, { latitude: b.latitude ?? NaN, longitude: b.longitude ?? NaN });
    return (distanciaA ?? Infinity) - (distanciaB ?? Infinity);
  });
}

export function formatearDistancia(km: number | null): string {
  if (km === null || !Number.isFinite(km)) return "Distancia no disponible";
  if (km < 1) return `${Math.round(km * 1000)} m en línea recta`;
  return `${km.toLocaleString("es-PE", { maximumFractionDigits: 1 })} km en línea recta`;
}
