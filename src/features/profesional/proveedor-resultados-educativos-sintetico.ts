import {
  crearServicioResultadosEducativos,
  type ResultadoEducativo,
  type ServicioResultadosEducativos,
} from "./resultados-educativos";

export type EscenarioResultadoEducativoDemo =
  | "disponible"
  | "vacio"
  | "error";

const RESULTADO_EDUCATIVO_DEMO: ResultadoEducativo = {
  id: "material-educativo-demo-cuidado-cotidiano",
  titulo: "Material educativo general sobre cuidado bucal cotidiano",
  observaciones: [
    "Este contenido se muestra solo para demostrar la interfaz; no proviene de una atención ni de un historial.",
  ],
  recomendaciones: [
    "Usa esta información como orientación general y conversa con un profesional ante dudas sobre tu cuidado bucal.",
  ],
  aviso:
    "Material educativo sintético. No es un diagnóstico, un plan de tratamiento ni una recomendación personalizada.",
  fuente: {
    id: "catalogo-educativo-sintetico",
    nombre: "Catálogo educativo sintético de demostración",
    tipo: "catalogo_educativo",
    disponible: true,
    atribucion: "Fuente local de demostración; no consulta servicios externos.",
  },
};

/**
 * Fuente local para DI-158. No usa el paciente ni el contexto para derivar
 * contenido: el material es general, fijo y no clínico.
 */
export function crearProveedorResultadosEducativosSintetico(
  escenario: EscenarioResultadoEducativoDemo,
): ServicioResultadosEducativos {
  return crearServicioResultadosEducativos({
    async consultarResultadoAutorizado() {
      if (escenario === "vacio") {
        return { estado: "sin_datos" };
      }

      if (escenario === "error") {
        return { estado: "fuente_no_disponible" };
      }

      return { estado: "permitido", resultado: RESULTADO_EDUCATIVO_DEMO };
    },
  });
}
