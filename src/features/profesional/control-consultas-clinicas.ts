export type RecursoClinico =
  | "perfil"
  | "solicitudes"
  | "pacientes"
  | "historial";

export interface ConsultaClinicaVigente {
  readonly signal: AbortSignal;
  vigente(): boolean;
  finalizar(): void;
}

/** Restablece un indicador de paginación al restringir el contexto actual. */
export function finalizarPaginacionRestringida<T extends { cargandoMas: boolean }>(
  estado: T,
): T {
  return estado.cargandoMas ? { ...estado, cargandoMas: false } : estado;
}

/**
 * Coordina las consultas de una vista clínica sin almacenar respuestas ni
 * identidad. Al cambiar sesión, clínica o paciente se abortan las peticiones
 * pendientes y sus resultados dejan de ser vigentes.
 */
export function crearControlConsultasClinicas() {
  let versionContexto = 0;
  const controladores = new Map<RecursoClinico, AbortController>();

  function cancelar(recurso: RecursoClinico) {
    const anterior = controladores.get(recurso);
    if (anterior) {
      anterior.abort();
      controladores.delete(recurso);
    }
  }

  return {
    iniciar(recurso: RecursoClinico): ConsultaClinicaVigente {
      cancelar(recurso);

      const controlador = new AbortController();
      const version = versionContexto;
      controladores.set(recurso, controlador);

      return {
        signal: controlador.signal,
        vigente: () =>
          version === versionContexto &&
          !controlador.signal.aborted &&
          controladores.get(recurso) === controlador,
        finalizar: () => {
          if (controladores.get(recurso) === controlador) {
            controladores.delete(recurso);
          }
        },
      };
    },

    cancelar,

    invalidarTodo() {
      versionContexto += 1;
      for (const controlador of controladores.values()) {
        controlador.abort();
      }
      controladores.clear();
    },
  };
}
