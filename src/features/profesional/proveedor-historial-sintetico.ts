import {
  crearServicioHistorialAutorizado,
  type AuditorHistorialSintetico,
  type ConcesionHistorialSintetica,
  type ContextoProfesionalSintetico,
  type FuenteHistorialAutorizado,
  type ServicioHistorialAutorizado,
  type VistaHistorialAutorizada,
} from "./historial-autorizado";
import {
  CASOS_HISTORIAL_DEMO,
  type AtencionClinicaSintetica,
  type CasoHistorialSintetico,
} from "./historial-sintetico";

/** Contextos ficticios que la demostración permite seleccionar. */
export const CONTEXTOS_PROFESIONALES_DEMO: readonly ContextoProfesionalSintetico[] = [
  {
    id: "contexto-demo-norte",
    professionalId: "profesional-demo-a",
    professionalName: "Profesional ficticio A",
    clinicId: "clinica-demo-norte",
    clinicName: "Clínica de contexto ficticia Norte",
  },
  {
    id: "contexto-demo-sur",
    professionalId: "profesional-demo-c",
    professionalName: "Profesional ficticio C",
    clinicId: "clinica-demo-sur",
    clinicName: "Clínica de contexto ficticia Sur",
  },
];

/**
 * Concesiones locales para la demostración. La primera autoriza atenciones de
 * dos clínicas de origen distintas; la segunda limita deliberadamente la
 * lectura a una atención para probar el alcance por registro.
 */
const CONCESIONES_HISTORIAL_DEMO: readonly ConcesionHistorialSintetica[] = [
  {
    patientId: "paciente-demo-a",
    contextId: "contexto-demo-norte",
    encounterIds: ["atencion-demo-a-1", "atencion-demo-a-2"],
  },
  {
    patientId: "paciente-demo-b",
    contextId: "contexto-demo-sur",
    encounterIds: ["atencion-demo-b-2"],
  },
];

function obtenerCaso(patientId: string): CasoHistorialSintetico | undefined {
  return CASOS_HISTORIAL_DEMO.find((caso) => caso.patientId === patientId);
}

function obtenerContexto(
  contextId: string,
): ContextoProfesionalSintetico | undefined {
  return CONTEXTOS_PROFESIONALES_DEMO.find(
    (contexto) => contexto.id === contextId,
  );
}

function obtenerConcesion(
  patientId: string,
  contextId: string,
): ConcesionHistorialSintetica | undefined {
  return CONCESIONES_HISTORIAL_DEMO.find(
    (concesion) =>
      concesion.patientId === patientId && concesion.contextId === contextId,
  );
}

const fuenteHistorialSintetico: FuenteHistorialAutorizado<
  AtencionClinicaSintetica,
  CasoHistorialSintetico
> = {
  obtenerCaso,
  obtenerContexto,
  obtenerConcesion,
};

/**
 * El registro vive solo en memoria del navegador y puede perderse o alterarse.
 * Sirve para demostrar la política de fallo cerrado; no es auditoría real.
 */
function crearAuditorHistorialDemostracion(): AuditorHistorialSintetico {
  let ultimoEvento:
    | {
        operacion: "consulta_historial";
        patientId: string;
        contextId: string;
        resultado: "permitido" | "denegado" | "sin_datos" | "error";
      }
    | undefined;

  return {
    registrar(evento) {
      ultimoEvento = { ...evento };
      void ultimoEvento;
    },
  };
}

export type VistaHistorialSinteticaAutorizada = VistaHistorialAutorizada<
  AtencionClinicaSintetica,
  CasoHistorialSintetico
>;

export function crearProveedorHistorialSintetico(
  auditor: AuditorHistorialSintetico = crearAuditorHistorialDemostracion(),
): ServicioHistorialAutorizado<
  AtencionClinicaSintetica,
  CasoHistorialSintetico
> {
  return crearServicioHistorialAutorizado(
    fuenteHistorialSintetico,
    auditor,
    "requerida",
  );
}

export function contextoPredeterminadoPaciente(patientId: string): string {
  return (
    CONCESIONES_HISTORIAL_DEMO.find(
      (concesion) => concesion.patientId === patientId,
    )?.contextId ?? CONTEXTOS_PROFESIONALES_DEMO[0].id
  );
}
