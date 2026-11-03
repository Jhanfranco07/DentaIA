/**
 * Estados usados exclusivamente para demostrar cómo respondería un contrato de
 * autorización. No representan permisos almacenados ni evaluados por Supabase.
 */
export type EstadoPermisoSimulado =
  | "concedido"
  | "denegado"
  | "expirado"
  | "revocado";

export type EscenarioConsultaHistorial =
  | EstadoPermisoSimulado
  | "vacio"
  | "error";

export type EstadoVistaHistorial =
  | "cargando"
  | "listo"
  | "vacio"
  | "denegado"
  | "error";

export interface EntradaHistorialAutorizable {
  encounterId: string;
  attendedAt: string;
  recordedAt: string;
}

export interface CasoHistorialAutorizable<
  Entrada extends EntradaHistorialAutorizable = EntradaHistorialAutorizable,
> {
  patientId: string;
  professionalContext: string;
  clinicContext: string;
  entries: readonly Entrada[];
}

export interface ContextoProfesionalSintetico {
  id: string;
  professionalId: string;
  professionalName: string;
  clinicId: string;
  clinicName: string;
}

export interface ConcesionHistorialSintetica {
  patientId: string;
  contextId: string;
  encounterIds: readonly string[];
}

export interface SolicitudConsultaHistorial {
  patientId: string;
  contextId: string;
  escenario: EscenarioConsultaHistorial;
}

/**
 * Límite entre la interfaz y cualquier fuente futura (RPC/API de Supabase).
 * La fuente real deberá decidir la autorización en el servidor, no en el
 * navegador; esta interfaz solo modela las respuestas que la UI puede recibir.
 */
export interface FuenteHistorialAutorizado<
  Entrada extends EntradaHistorialAutorizable,
  Caso extends CasoHistorialAutorizable<Entrada>,
> {
  obtenerCaso(patientId: string): Caso | undefined;
  obtenerContexto(
    contextId: string,
  ): ContextoProfesionalSintetico | undefined;
  obtenerConcesion(
    patientId: string,
    contextId: string,
  ): ConcesionHistorialSintetica | undefined;
}

/** No incluye `entries` para que el resultado no transporte registros no autorizados. */
export type ResumenCasoAutorizado<
  Caso extends CasoHistorialAutorizable<Entrada>,
  Entrada extends EntradaHistorialAutorizable,
> = Omit<Caso, "entries">;

export interface VistaHistorialAutorizada<
  Entrada extends EntradaHistorialAutorizable = EntradaHistorialAutorizable,
  Caso extends CasoHistorialAutorizable<Entrada> = CasoHistorialAutorizable<Entrada>,
> {
  estado: EstadoVistaHistorial;
  caso: ResumenCasoAutorizado<Caso, Entrada> | null;
  entries: readonly Entrada[];
  origen: "sintetico";
  permisoSimulado: EstadoPermisoSimulado | null;
}

export interface ServicioHistorialAutorizado<
  Entrada extends EntradaHistorialAutorizable,
  Caso extends CasoHistorialAutorizable<Entrada>,
> {
  consultar(
    solicitud: SolicitudConsultaHistorial,
  ): Promise<VistaHistorialAutorizada<Entrada, Caso>>;
}

function vistaBase<
  Entrada extends EntradaHistorialAutorizable,
  Caso extends CasoHistorialAutorizable<Entrada>,
>(
  estado: EstadoVistaHistorial,
  permisoSimulado: EstadoPermisoSimulado | null,
): VistaHistorialAutorizada<Entrada, Caso> {
  return {
    estado,
    caso: null,
    entries: [],
    origen: "sintetico",
    permisoSimulado,
  };
}

function vistaSinAutorizacion<
  Entrada extends EntradaHistorialAutorizable,
  Caso extends CasoHistorialAutorizable<Entrada>,
>(
  permisoSimulado: Exclude<EstadoPermisoSimulado, "concedido">,
): VistaHistorialAutorizada<Entrada, Caso> {
  return vistaBase("denegado", permisoSimulado);
}

function ordenarEntradas<Entrada extends EntradaHistorialAutorizable>(
  entries: readonly Entrada[],
): Entrada[] {
  return [...entries].sort((primera, segunda) => {
    const porAtencion = segunda.attendedAt.localeCompare(primera.attendedAt);

    return porAtencion || segunda.recordedAt.localeCompare(primera.recordedAt);
  });
}

/**
 * Construye el servicio a partir de una fuente inyectada. El proveedor
 * sintético se mantiene aparte para que este contrato pueda reemplazarse por
 * una operación autorizada de Supabase cuando exista el backend necesario.
 */
export function crearServicioHistorialAutorizado<
  Entrada extends EntradaHistorialAutorizable,
  Caso extends CasoHistorialAutorizable<Entrada>,
>(
  fuente: FuenteHistorialAutorizado<Entrada, Caso>,
): ServicioHistorialAutorizado<Entrada, Caso> {
  return {
    async consultar({ patientId, contextId, escenario }) {
      if (escenario === "error") {
        return vistaBase<Entrada, Caso>("error", null);
      }

      if (escenario === "vacio") {
        return vistaBase<Entrada, Caso>("vacio", null);
      }

      if (escenario !== "concedido") {
        return vistaSinAutorizacion<Entrada, Caso>(escenario);
      }

      const caso = fuente.obtenerCaso(patientId);
      const contexto = fuente.obtenerContexto(contextId);
      const concesion = fuente.obtenerConcesion(patientId, contextId);

      // La ausencia de caso, contexto o concesión no revela cuál de ellos
      // falló: la interfaz recibe la misma denegación segura.
      if (!caso || !contexto || !concesion) {
        return vistaSinAutorizacion<Entrada, Caso>("denegado");
      }

      const encuentrosAutorizados = new Set(concesion.encounterIds);
      const entries = ordenarEntradas(caso.entries).filter((atencion) =>
        encuentrosAutorizados.has(atencion.encounterId),
      );

      if (entries.length === 0) {
        return vistaBase<Entrada, Caso>("vacio", "concedido");
      }

      const { entries: _entriesNoAutorizadas, ...resumen } = caso;

      return {
        estado: "listo",
        caso: {
          ...resumen,
          professionalContext: contexto.professionalName,
          clinicContext: contexto.clinicName,
        },
        entries,
        origen: "sintetico",
        permisoSimulado: "concedido",
      };
    },
  };
}
