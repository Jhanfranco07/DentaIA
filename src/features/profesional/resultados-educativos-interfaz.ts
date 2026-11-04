import type {
  RespuestaConsultaResultadoEducativo,
  ResultadoEducativo,
} from "./resultados-educativos";

export type EstadoVistaResultadosEducativos =
  | "cargando"
  | "contenido"
  | "vacio"
  | "denegado"
  | "error";

export interface VistaResultadosEducativos {
  estado: EstadoVistaResultadosEducativos;
  resultado: ResultadoEducativo | null;
}

/** La interfaz parte sin contenido para no conservar un resultado anterior. */
export function iniciarVistaResultadosEducativos(): VistaResultadosEducativos {
  return { estado: "cargando", resultado: null };
}

/**
 * Traduce exclusivamente la respuesta ya normalizada por el contrato de
 * resultados educativos. La UI nunca recibe la respuesta cruda del proveedor.
 */
export function resolverVistaResultadosEducativos(
  respuesta: RespuestaConsultaResultadoEducativo,
): VistaResultadosEducativos {
  if (respuesta.estado === "permitido") {
    return { estado: "contenido", resultado: respuesta.resultado };
  }

  if (respuesta.estado === "sin_datos") {
    return { estado: "vacio", resultado: null };
  }

  if (
    respuesta.estado === "no_autorizado" ||
    respuesta.estado === "expirado" ||
    respuesta.estado === "revocado"
  ) {
    return { estado: "denegado", resultado: null };
  }

  return {
    estado: respuesta.estado === "cargando" ? "cargando" : "error",
    resultado: null,
  };
}
