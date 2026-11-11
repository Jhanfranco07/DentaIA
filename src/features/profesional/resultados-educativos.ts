/**
 * Contrato de consulta para material educativo de demostración. Este módulo no
 * representa historial clínico, no infiere diagnósticos y no implementa
 * autorización real.
 *
 * Una operación única reduce el riesgo de separar la comprobación del permiso
 * de la recuperación del contenido, pero no garantiza atomicidad ni seguridad
 * por sí sola. Un proveedor productivo deberá verificar en el servidor la
 * identidad autenticada, el contexto, la autorización vigente y el acceso a
 * los datos, además de registrar la auditoría necesaria. No debe depender de
 * esta interfaz como mecanismo de seguridad.
 */

/** Este MVP solo expone permisos simulados; no existe modalidad de servidor. */
export type ModalidadAutorizacionEducativa = "simulada";

export type EstadoAutorizacionEducativa =
  | "permitido"
  | "no_autorizado"
  | "expirado"
  | "revocado";

export type EstadoConsultaResultadoEducativo =
  | "cargando"
  | EstadoAutorizacionEducativa
  | "sin_datos"
  | "fuente_no_disponible"
  | "error";

type EstadoRespuestaProveedor = Exclude<
  EstadoConsultaResultadoEducativo,
  "cargando"
>;

export interface SolicitudResultadoEducativo {
  patientId: string;
  contextId: string;
}

export interface FuenteResultadoEducativo {
  id: string;
  nombre: string;
  tipo: "catalogo_educativo" | "reporte_preventivo";
  disponible: boolean;
  atribucion?: string;
}

/**
 * Contenido orientativo. No incluye campos clínicos, identidad del paciente,
 * diagnósticos, tratamientos ni inferencias de IA.
 */
export interface ResultadoEducativo {
  id: string;
  titulo: string;
  observaciones: readonly string[];
  recomendaciones: readonly string[];
  aviso: string;
  fuente: FuenteResultadoEducativo;
}

export interface RespuestaProveedorPermitida {
  estado: "permitido";
  resultado: ResultadoEducativo;
}

/**
 * Las respuestas del proveedor sin permiso o sin contenido no transportan
 * resultado. `never` impide añadirlo al usar el contrato de TypeScript.
 */
export interface RespuestaProveedorSinContenido {
  estado: Exclude<EstadoRespuestaProveedor, "permitido">;
  resultado?: never;
}

export type RespuestaProveedorResultadoEducativo =
  | RespuestaProveedorPermitida
  | RespuestaProveedorSinContenido;

interface RespuestaSinContenido {
  estado: Exclude<EstadoConsultaResultadoEducativo, "permitido">;
  modalidadAutorizacion: ModalidadAutorizacionEducativa;
  resultado: null;
}

interface RespuestaPermitida {
  estado: "permitido";
  modalidadAutorizacion: ModalidadAutorizacionEducativa;
  resultado: ResultadoEducativo;
}

export type RespuestaConsultaResultadoEducativo =
  | RespuestaSinContenido
  | RespuestaPermitida;

/**
 * Fuente sustituible e independiente del historial clínico. El proveedor debe
 * resolver autorización y contenido en una única operación. Para una fuente
 * real, esa operación debe ejecutarse y autorizarse en el servidor; el cliente
 * no debe aportar ni decidir la identidad efectiva ni el permiso.
 */
export interface FuenteResultadosEducativos {
  consultarResultadoAutorizado(
    solicitud: SolicitudResultadoEducativo,
  ): Promise<RespuestaProveedorResultadoEducativo>;
}

export interface ServicioResultadosEducativos {
  /** `unknown` permite rechazar de forma segura solicitudes malformadas. */
  consultar(
    solicitud: unknown,
  ): Promise<RespuestaConsultaResultadoEducativo>;
}

const MODALIDAD_AUTORIZACION: ModalidadAutorizacionEducativa = "simulada";

const ESTADOS_PROVEEDOR = new Set<EstadoRespuestaProveedor>([
  "permitido",
  "no_autorizado",
  "expirado",
  "revocado",
  "sin_datos",
  "fuente_no_disponible",
  "error",
]);

function respuestaSinContenido(
  estado: Exclude<EstadoConsultaResultadoEducativo, "permitido">,
): RespuestaSinContenido {
  return {
    estado,
    modalidadAutorizacion: MODALIDAD_AUTORIZACION,
    resultado: null,
  };
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function listaDeTextosValida(valor: unknown): valor is readonly string[] {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every((texto) => textoValido(texto))
  );
}

function normalizarSolicitud(
  solicitud: unknown,
): SolicitudResultadoEducativo | null {
  if (!esRegistro(solicitud)) return null;

  const { patientId, contextId } = solicitud;

  if (!textoValido(patientId) || !textoValido(contextId)) return null;

  return {
    patientId: patientId.trim(),
    contextId: contextId.trim(),
  };
}

function normalizarFuente(
  fuente: unknown,
): FuenteResultadoEducativo | null {
  if (!esRegistro(fuente)) return null;

  const { id, nombre, tipo, disponible, atribucion } = fuente;

  if (
    !textoValido(id) ||
    !textoValido(nombre) ||
    (tipo !== "catalogo_educativo" && tipo !== "reporte_preventivo") ||
    disponible !== true ||
    (atribucion !== undefined && !textoValido(atribucion))
  ) {
    return null;
  }

  return {
    id: id.trim(),
    nombre: nombre.trim(),
    tipo,
    disponible,
    ...(atribucion === undefined ? {} : { atribucion: atribucion.trim() }),
  };
}

/** Reconstruye una lista blanca; nunca propaga propiedades clínicas ajenas. */
function normalizarResultado(
  resultado: unknown,
): ResultadoEducativo | null {
  if (!esRegistro(resultado)) return null;

  const { id, titulo, observaciones, recomendaciones, aviso, fuente } = resultado;
  const fuenteNormalizada = normalizarFuente(fuente);

  if (
    !textoValido(id) ||
    !textoValido(titulo) ||
    !listaDeTextosValida(observaciones) ||
    !listaDeTextosValida(recomendaciones) ||
    !textoValido(aviso) ||
    !fuenteNormalizada
  ) {
    return null;
  }

  return {
    id: id.trim(),
    titulo: titulo.trim(),
    observaciones: observaciones.map((texto) => texto.trim()),
    recomendaciones: recomendaciones.map((texto) => texto.trim()),
    aviso: aviso.trim(),
    fuente: fuenteNormalizada,
  };
}

function esEstadoProveedor(valor: unknown): valor is EstadoRespuestaProveedor {
  return (
    typeof valor === "string" &&
    ESTADOS_PROVEEDOR.has(valor as EstadoRespuestaProveedor)
  );
}

function tieneSoloEstado(respuesta: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(respuesta, "estado") &&
    Object.keys(respuesta).length === 1
  );
}

function normalizarRespuestaProveedor(
  respuesta: unknown,
): RespuestaConsultaResultadoEducativo {
  if (!esRegistro(respuesta) || !esEstadoProveedor(respuesta.estado)) {
    return respuestaSinContenido("error");
  }

  if (respuesta.estado !== "permitido") {
    return tieneSoloEstado(respuesta)
      ? respuestaSinContenido(respuesta.estado)
      : respuestaSinContenido("error");
  }

  const resultado = normalizarResultado(respuesta.resultado);

  return resultado
    ? {
        estado: "permitido",
        modalidadAutorizacion: MODALIDAD_AUTORIZACION,
        resultado,
      }
    : respuestaSinContenido("error");
}

/** Estado inicial para una interfaz que todavía espera la respuesta del proveedor. */
export function iniciarConsultaResultadoEducativo(): RespuestaConsultaResultadoEducativo {
  return respuestaSinContenido("cargando");
}

/**
 * Crea un servicio a partir de una fuente inyectada. Todas las entradas,
 * respuestas inválidas y excepciones se convierten en una respuesta segura sin
 * contenido. La modalidad siempre es `simulada` en este MVP y no acredita una
 * autorización productiva.
 */
export function crearServicioResultadosEducativos(
  fuente: FuenteResultadosEducativos,
): ServicioResultadosEducativos {
  return {
    async consultar(solicitud) {
      try {
        const solicitudNormalizada = normalizarSolicitud(solicitud);

        if (!solicitudNormalizada) {
          return respuestaSinContenido("error");
        }

        const respuesta = await fuente.consultarResultadoAutorizado(
          solicitudNormalizada,
        );

        return normalizarRespuestaProveedor(respuesta);
      } catch {
        return respuestaSinContenido("error");
      }
    },
  };
}
