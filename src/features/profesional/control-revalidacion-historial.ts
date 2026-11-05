/**
 * Coalesce revalidation signals from focus, visibility and the bounded timer.
 * A signal received during an active request is retained as one follow-up read.
 */
export function crearControlRevalidacionHistorial() {
  let siguienteId = 0;
  let activa: number | null = null;
  let pendiente = false;

  function iniciar(): number {
    const id = ++siguienteId;
    activa = id;
    return id;
  }

  return {
    solicitar(): number | null {
      if (activa !== null) {
        pendiente = true;
        return null;
      }
      return iniciar();
    },

    activa(id: number): boolean {
      return activa === id;
    },

    finalizar(id: number): number | null {
      if (activa !== id) return null;
      if (pendiente) {
        pendiente = false;
        return iniciar();
      }
      activa = null;
      return null;
    },

    invalidar() {
      activa = null;
      pendiente = false;
    },
  };
}

/** Clears accumulated pages before a fresh server-authorized history read. */
export function estadoRevalidacionHistorial() {
  return {
    vista: { estado: "cargando" as const, historial: null },
    cargandoMas: false,
  };
}
