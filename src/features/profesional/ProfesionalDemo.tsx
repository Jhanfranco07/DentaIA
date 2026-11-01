"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import EstadoHistorial from "./EstadoHistorial";
import {
  CASOS_HISTORIAL_DEMO,
  type EscenarioInterfaz,
  iniciarConsultaHistorial,
  resolverConsultaHistorial,
} from "./historial-sintetico";
import styles from "./profesional.module.css";

const ESCENARIOS: ReadonlyArray<{
  id: EscenarioInterfaz;
  etiqueta: string;
}> = [
  { id: "contenido", etiqueta: "Contenido sintético" },
  { id: "vacio", etiqueta: "Sin datos" },
  { id: "denegado", etiqueta: "Acceso denegado" },
  { id: "error", etiqueta: "Error de carga" },
];

const DEMORA_DEMOSTRACION_MS = 250;

export default function ProfesionalDemo() {
  const [casoId, setCasoId] = useState(CASOS_HISTORIAL_DEMO[0].patientId);
  const [escenario, setEscenario] =
    useState<EscenarioInterfaz>("contenido");
  const [vista, setVista] = useState(iniciarConsultaHistorial);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setVista(resolverConsultaHistorial(casoId, escenario));
    }, DEMORA_DEMOSTRACION_MS);

    return () => window.clearTimeout(temporizador);
  }, [casoId, escenario]);

  function cambiarCaso(nuevoCasoId: string) {
    setVista(iniciarConsultaHistorial());
    setCasoId(nuevoCasoId);
  }

  function cambiarEscenario(nuevoEscenario: EscenarioInterfaz) {
    setVista(iniciarConsultaHistorial());
    setEscenario(nuevoEscenario);
  }

  return (
    <section className={styles.pagina} aria-labelledby="titulo-profesional">
      <header className={styles.encabezado}>
        <p className={styles.etiquetaSuperior}>DENTAIA / PORTAL PROFESIONAL</p>
        <h1 id="titulo-profesional">Panel del odontólogo</h1>
        <p>
          Demostración de una consulta clínica compartida de solo lectura con
          datos sintéticos.
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
            Selecciona un caso ficticio para revisar su cronología y la
            procedencia de cada atención.
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

          <fieldset className={styles.escenarios}>
            <legend>Escenario de interfaz</legend>
            <p>
              Simulación visual para revisar estados; no evalúa permisos ni
              seguridad clínica.
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
