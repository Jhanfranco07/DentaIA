export function adjuntarUbicaciones<T extends { id: string }, U extends { dentist_id: string }>(
  dentistas: readonly T[], respuesta: { data: readonly U[] | null; error: unknown | null },
) {
  const disponibles = respuesta.error === null;
  const ubicaciones = disponibles ? respuesta.data ?? [] : [];
  return {
    disponibles,
    dentistas: dentistas.map(dentista => ({
      ...dentista,
      ubicaciones: ubicaciones.filter(ubicacion => ubicacion.dentist_id === dentista.id),
    })),
  };
}

export function normalizarResenas<T>(respuesta: { data: readonly T[] | null; error: unknown | null }) {
  return {
    disponibles: respuesta.error === null,
    resenas: respuesta.error === null ? respuesta.data ?? [] : [],
  };
}
