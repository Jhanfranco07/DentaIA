export type EstadoDatoClinico =
  | "registrado"
  | "no_registrado"
  | "desconocido";

export type DisponibilidadExamen = "disponible" | "no_disponible";

export interface CampoClinico {
  estado: EstadoDatoClinico;
  valor?: string;
}

export interface ReferenciaExamen {
  id: string;
  nombre: string;
  fecha: string;
  disponibilidad: DisponibilidadExamen;
  referencia?: string;
}

export interface AtencionClinicaSintetica {
  encounterId: string;
  attendedAt: string;
  recordedAt: string;
  professional: string;
  originClinic: string;
  background: CampoClinico;
  diagnoses: CampoClinico;
  treatments: CampoClinico;
  exams: readonly ReferenciaExamen[];
}

export interface CasoHistorialSintetico {
  patientId: string;
  patientAlias: string;
  professionalContext: string;
  clinicContext: string;
  entries: readonly AtencionClinicaSintetica[];
}

export const CASOS_HISTORIAL_DEMO: readonly CasoHistorialSintetico[] = [
  {
    patientId: "paciente-demo-a",
    patientAlias: "Paciente de demostración A",
    professionalContext: "Profesional ficticio A",
    clinicContext: "Clínica de contexto ficticia Norte",
    entries: [
      {
        encounterId: "atencion-demo-a-1",
        attendedAt: "2026-06-11",
        recordedAt: "2026-06-12",
        professional: "Profesional ficticio B",
        originClinic: "Clínica ficticia Centro",
        background: { estado: "desconocido" },
        diagnoses: {
          estado: "registrado",
          valor: "Registro diagnóstico sintético para demostración.",
        },
        treatments: { estado: "no_registrado" },
        exams: [
          {
            id: "examen-demo-a-1",
            nombre: "Referencia de examen sintético",
            fecha: "2026-06-11",
            disponibilidad: "no_disponible",
          },
        ],
      },
      {
        encounterId: "atencion-demo-a-2",
        attendedAt: "2026-09-18",
        recordedAt: "2026-09-20",
        professional: "Profesional ficticio A",
        originClinic: "Clínica ficticia Costa",
        background: { estado: "no_registrado" },
        diagnoses: { estado: "no_registrado" },
        treatments: {
          estado: "registrado",
          valor: "Tratamiento sintético registrado para demostración.",
        },
        exams: [
          {
            id: "examen-demo-a-2",
            nombre: "Referencia de control sintética",
            fecha: "2026-09-18",
            disponibilidad: "disponible",
            referencia: "Referencia sintética disponible; no corresponde a un archivo clínico real.",
          },
        ],
      },
    ],
  },
  {
    patientId: "paciente-demo-b",
    patientAlias: "Paciente de demostración B",
    professionalContext: "Profesional ficticio C",
    clinicContext: "Clínica de contexto ficticia Sur",
    entries: [
      {
        encounterId: "atencion-demo-b-1",
        attendedAt: "2026-08-03",
        recordedAt: "2026-08-03",
        professional: "Profesional ficticio D",
        originClinic: "Clínica ficticia Este",
        background: {
          estado: "registrado",
          valor: "Antecedente sintético consignado para demostración.",
        },
        diagnoses: { estado: "desconocido" },
        treatments: { estado: "no_registrado" },
        exams: [
          {
            id: "examen-demo-b-1",
            nombre: "Referencia de examen sintético",
            fecha: "2026-08-03",
            disponibilidad: "no_disponible",
          },
        ],
      },
      {
        encounterId: "atencion-demo-b-2",
        attendedAt: "2026-10-09",
        recordedAt: "2026-10-10",
        professional: "Profesional ficticio C",
        originClinic: "Clínica ficticia Sur",
        background: {
          estado: "registrado",
          valor: "Antecedente sintético actualizado para demostración.",
        },
        diagnoses: {
          estado: "registrado",
          valor: "Registro diagnóstico sintético para demostración.",
        },
        treatments: {
          estado: "registrado",
          valor: "Tratamiento sintético registrado para demostración.",
        },
        exams: [
          {
            id: "examen-demo-b-2",
            nombre: "Referencia de control sintética",
            fecha: "2026-10-09",
            disponibilidad: "disponible",
            referencia: "Referencia sintética disponible; no corresponde a un archivo clínico real.",
          },
        ],
      },
    ],
  },
];

export type EscenarioInterfaz =
  | "contenido"
  | "vacio"
  | "denegado"
  | "error";

export type EstadoHistorial =
  | "cargando"
  | "listo"
  | "vacio"
  | "denegado"
  | "error";

export interface VistaHistorial {
  estado: EstadoHistorial;
  caso: CasoHistorialSintetico | null;
  entries: readonly AtencionClinicaSintetica[];
}

export function obtenerCasoSintetico(
  patientId: string,
): CasoHistorialSintetico | undefined {
  return CASOS_HISTORIAL_DEMO.find((caso) => caso.patientId === patientId);
}

export function ordenarAtenciones(
  entries: readonly AtencionClinicaSintetica[],
): AtencionClinicaSintetica[] {
  return [...entries].sort((primera, segunda) => {
    const porAtencion = segunda.attendedAt.localeCompare(primera.attendedAt);

    return porAtencion || segunda.recordedAt.localeCompare(primera.recordedAt);
  });
}

export function textoCampoClinico(campo: CampoClinico): string {
  if (campo.estado === "no_registrado") {
    return "No registrado en la fuente sintética.";
  }

  if (campo.estado === "desconocido") {
    return "Dato desconocido en la fuente sintética.";
  }

  return campo.valor?.trim() || "No registrado en la fuente sintética.";
}

export function formatearFechaClinica(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return "Fecha no disponible";
  }

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fechaLocal = new Date(anio, mes - 1, dia, 12);

  if (
    Number.isNaN(fechaLocal.getTime()) ||
    fechaLocal.getFullYear() !== anio ||
    fechaLocal.getMonth() !== mes - 1 ||
    fechaLocal.getDate() !== dia
  ) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fechaLocal);
}

export function iniciarConsultaHistorial(): VistaHistorial {
  return { estado: "cargando", caso: null, entries: [] };
}

export function resolverConsultaHistorial(
  patientId: string,
  escenario: EscenarioInterfaz,
): VistaHistorial {
  const caso = obtenerCasoSintetico(patientId);

  if (!caso || escenario === "error") {
    return { estado: "error", caso: null, entries: [] };
  }

  if (escenario === "vacio") {
    return { estado: "vacio", caso: null, entries: [] };
  }

  if (escenario === "denegado") {
    return { estado: "denegado", caso: null, entries: [] };
  }

  const entries = ordenarAtenciones(caso.entries);

  if (entries.length === 0) {
    return { estado: "vacio", caso: null, entries: [] };
  }

  return { estado: "listo", caso, entries };
}
