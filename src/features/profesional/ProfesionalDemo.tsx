"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import EstadoHistorial from "./EstadoHistorial";
import {
  CASOS_HISTORIAL_DEMO,
  iniciarConsultaHistorial,
} from "./historial-sintetico";
import {
  type EscenarioConsultaHistorial,
} from "./historial-autorizado";
import {
  CONTEXTOS_PROFESIONALES_DEMO,
  contextoPredeterminadoPaciente,
  crearProveedorHistorialSintetico,
  type VistaHistorialSinteticaAutorizada,
} from "./proveedor-historial-sintetico";
import styles from "./profesional.module.css";

const ESCENARIOS: ReadonlyArray<{
  id: EscenarioConsultaHistorial;
  etiqueta: string;
}> = [
  { id: "concedido", etiqueta: "Permiso concedido" },
  { id: "denegado", etiqueta: "Permiso denegado" },
  { id: "expirado", etiqueta: "Permiso expirado" },
  { id: "revocado", etiqueta: "Permiso revocado" },
  { id: "vacio", etiqueta: "Sin datos" },
  { id: "error", etiqueta: "Error de carga" },
];

const DEMORA_DEMOSTRACION_MS = 250;

function iniciarVistaAutorizada(): VistaHistorialSinteticaAutorizada {
  return {
    ...iniciarConsultaHistorial(),
    origen: "sintetico",
    permisoSimulado: null,
  };
}

export default function ProfesionalDemo() {
  const [casoId, setCasoId] = useState(CASOS_HISTORIAL_DEMO[0].patientId);
  const [contextoId, setContextoId] = useState(
    contextoPredeterminadoPaciente(CASOS_HISTORIAL_DEMO[0].patientId),
  );
  const [escenario, setEscenario] =
    useState<EscenarioConsultaHistorial>("concedido");
  const [vista, setVista] = useState<VistaHistorialSinteticaAutorizada>(
    iniciarVistaAutorizada,
  );
  const proveedor = useMemo(crearProveedorHistorialSintetico, []);

  useEffect(() => {
    let activa = true;
    const temporizador = window.setTimeout(() => {
      void proveedor
        .consultar({ patientId: casoId, contextId: contextoId, escenario })
        .then((resultado) => {
          if (activa) setVista(resultado);
        })
        .catch(() => {
          if (activa) {
            setVista({
              ...iniciarVistaAutorizada(),
              estado: "error",
            });
          }
        });
    }, DEMORA_DEMOSTRACION_MS);

    return () => {
      activa = false;
      window.clearTimeout(temporizador);
    };
  }, [casoId, contextoId, escenario, proveedor]);

  function cambiarCaso(nuevoCasoId: string) {
    setVista(iniciarVistaAutorizada());
    setCasoId(nuevoCasoId);
    setContextoId(contextoPredeterminadoPaciente(nuevoCasoId));
  }

  function cambiarContexto(nuevoContextoId: string) {
    setVista(iniciarVistaAutorizada());
    setContextoId(nuevoContextoId);
  }

  function cambiarEscenario(nuevoEscenario: EscenarioConsultaHistorial) {
    setVista(iniciarVistaAutorizada());
    setEscenario(nuevoEscenario);
  }

  return (
    <section className={styles.pagina} aria-labelledby="titulo-profesional">
      <header className={styles.encabezado}>
        <p className={styles.etiquetaSuperior}>DENTAIA / PORTAL PROFESIONAL</p>
        <h1 id="titulo-profesional">Panel del odontólogo</h1>
        <p>
          Demostración de una consulta clínica compartida de solo lectura con
          datos y permisos sintéticos.
        </p>
      </header>

      <aside
        className={styles.avisoDemostracion}
        aria-label="Alcance de la demostración"
      >
        <strong>Entorno de demostración</strong>
        <p>
          No se consulta información clínica real. Esta interfaz no implementa
          autenticación profesional, autorización, concesiones, revocación ni
          auditoría.
        </p>
      </aside>

      <nav className={styles.navegacion} aria-label="Navegación profesional">
        <a href="#historial-clinico">Historial clínico</a>
        <a href="#solicitudes-demostracion">Solicitudes de demostración</a>
        <Link href="/">Inicio</Link>
      </nav>

      <section
        id="historial-clinico"
        className={styles.tarjeta}
        aria-labelledby="titulo-historial"
      >
        <header className={styles.cabeceraSeccion}>
          <p className={styles.etiquetaSeccion}>
            SOLO LECTURA · DATOS SINTÉTICOS
          </p>
          <h2 id="titulo-historial">Historial clínico compartido</h2>
          <p>
            Selecciona un caso y un contexto ficticios para revisar los
            registros incluidos en el permiso simulado y su procedencia.
          </p>
        </header>

        <div className={styles.controles}>
          <div className={styles.campo}>
            <label htmlFor="caso-sintetico">Caso de demostración</label>
            <select
              id="caso-sintetico"
              value={casoId}
              onChange={(evento) => cambiarCaso(evento.target.value)}
            >
              {CASOS_HISTORIAL_DEMO.map((caso) => (
                <option key={caso.patientId} value={caso.patientId}>
                  {caso.patientAlias}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.campo}>
            <label htmlFor="clinica-contexto">
              Clínica de contexto simulada
            </label>
            <select
              id="clinica-contexto"
              value={contextoId}
              onChange={(evento) => cambiarContexto(evento.target.value)}
            >
              {CONTEXTOS_PROFESIONALES_DEMO.map((contexto) => (
                <option key={contexto.id} value={contexto.id}>
                  {contexto.clinicName} · {contexto.professionalName}
                </option>
              ))}
            </select>
          </div>

          <fieldset className={styles.escenarios}>
            <legend>Escenario de interfaz</legend>
            <p>
              Simulación visual de respuestas del servicio; no evalúa permisos
              reales ni proporciona seguridad clínica.
            </p>
            <div className={styles.opcionesEscenario}>
              {ESCENARIOS.map((opcion) => (
                <label key={opcion.id} className={styles.opcionEscenario}>
                  <input
                    type="radio"
                    name="escenario-historial"
                    value={opcion.id}
                    checked={escenario === opcion.id}
                    onChange={() => cambiarEscenario(opcion.id)}
                  />
                  {opcion.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <EstadoHistorial vista={vista} />
      </section>

      <section
        id="solicitudes-demostracion"
        className={styles.tarjeta}
        aria-labelledby="titulo-solicitudes"
      >
        <p className={styles.etiquetaSeccion}>MÓDULO INDEPENDIENTE</p>
        <h2 id="titulo-solicitudes">Solicitudes de demostración</h2>
        <p>
          Las solicitudes no forman parte del historial clínico. Esta vista no
          consulta ni administra solicitudes profesionales.
        </p>
        <Link href="/solicitudes" className="text-link">
          Ir a mis solicitudes de demostración
        </Link>
      </section>
    </section>
  );
}
