import type {
  AtencionClinicaSintetica,
  CampoClinico,
  ReferenciaExamen,
} from "./historial-sintetico";
import type { VistaHistorialSinteticaAutorizada } from "./proveedor-historial-sintetico";
import {
  formatearFechaClinica,
  textoCampoClinico,
} from "./historial-sintetico";
import styles from "./profesional.module.css";

function CampoDetalle({
  titulo,
  campo,
}: {
  titulo: string;
  campo: CampoClinico;
}) {
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>{textoCampoClinico(campo)}</dd>
    </div>
  );
}

function ReferenciaExamenDetalle({
  examen,
}: {
  examen: ReferenciaExamen;
}) {
  const noDisponible = examen.disponibilidad === "no_disponible";

  return (
    <li className={styles.referenciaExamen}>
      <strong>{examen.nombre}</strong>
      <span>
        Fecha de referencia:{" "}
        <time dateTime={examen.fecha}>
          {formatearFechaClinica(examen.fecha)}
        </time>
      </span>
      {noDisponible ? (
        <span className={styles.examenNoDisponible}>
          Examen no disponible. No se muestra contenido ni se infiere su
          vigencia.
        </span>
      ) : (
        <span>{examen.referencia}</span>
      )}
    </li>
  );
}

function AtencionDetalle({
  atencion,
}: {
  atencion: AtencionClinicaSintetica;
}) {
  const fechaAtencion = formatearFechaClinica(atencion.attendedAt);
  const examenesId = ["examenes", atencion.encounterId].join("-");

  return (
    <li className={styles.itemCronologia}>
      <article className={styles.atencion}>
        <header className={styles.cabeceraAtencion}>
          <div>
            <p className={styles.fechaAtencion}>
              <time dateTime={atencion.attendedAt}>{fechaAtencion}</time>
            </p>
            <h3>Atención sintética de demostración</h3>
          </div>
          <span className={styles.identificador}>Dato sintético</span>
        </header>

        <dl className={styles.procedencia}>
          <div>
            <dt>Profesional responsable</dt>
            <dd>{atencion.professional}</dd>
          </div>
          <div>
            <dt>Clínica de origen</dt>
            <dd>{atencion.originClinic}</dd>
          </div>
          <div>
            <dt>Registrado el</dt>
            <dd>
              <time dateTime={atencion.recordedAt}>
                {formatearFechaClinica(atencion.recordedAt)}
              </time>
            </dd>
          </div>
        </dl>

        <details className={styles.detalleAtencion}>
          <summary>Ver detalle de la atención</summary>
          <dl className={styles.detalleClinico}>
            <CampoDetalle titulo="Antecedentes" campo={atencion.background} />
            <CampoDetalle titulo="Diagnósticos" campo={atencion.diagnoses} />
            <CampoDetalle titulo="Tratamientos" campo={atencion.treatments} />
          </dl>

          <section aria-labelledby={examenesId}>
            <h4 id={examenesId}>Exámenes y referencias</h4>
            <ul className={styles.listaExamenes}>
              {atencion.exams.map((examen) => (
                <ReferenciaExamenDetalle key={examen.id} examen={examen} />
              ))}
            </ul>
          </section>
        </details>
      </article>
    </li>
  );
}

export default function EstadoHistorial({
  vista,
}: {
  vista: VistaHistorialSinteticaAutorizada;
}) {
  if (vista.estado === "cargando") {
    return (
      <div className={styles.estadoCarga} role="status" aria-live="polite">
        Cargando historial sintético de demostración…
      </div>
    );
  }

  if (vista.estado === "vacio") {
    return (
      <div className={styles.estadoVacio} role="status">
        No hay atenciones sintéticas para mostrar en este escenario de
        interfaz.
      </div>
    );
  }

  if (vista.estado === "denegado") {
    const mensajePermiso =
      vista.permisoSimulado === "expirado"
        ? "El permiso simulado está expirado."
        : vista.permisoSimulado === "revocado"
          ? "El permiso simulado fue revocado."
          : "No existe un permiso simulado aplicable a esta consulta.";

    return (
      <div className={styles.estadoDenegado} role="alert">
        <strong>{mensajePermiso}</strong>
        <p>
          No se muestran datos clínicos. Este resultado es una demostración y
          no valida identidad, rol, concesiones reales ni auditoría.
        </p>
      </div>
    );
  }

  if (vista.estado === "error") {
    return (
      <div className={styles.estadoError} role="alert">
        <strong>No se pudo cargar el historial sintético.</strong>
        <p>
          El escenario de interfaz no entrega datos y no revela información de
          un paciente.
        </p>
      </div>
    );
  }

  if (!vista.caso) {
    return null;
  }

  return (
    <div className={styles.resultadoHistorial}>
      <header className={styles.resumenCaso}>
        <div>
          <p className={styles.etiquetaResultado}>
            Permiso simulado concedido · solo registros autorizados
          </p>
          <h3>{vista.caso.patientAlias}</h3>
        </div>
        <dl>
          <div>
            <dt>Profesional de contexto</dt>
            <dd>{vista.caso.professionalContext}</dd>
          </div>
          <div>
            <dt>Clínica de contexto</dt>
            <dd>{vista.caso.clinicContext}</dd>
          </div>
        </dl>
      </header>

      <p className={styles.ayudaResultado}>
        Cronología sintética de demostración. La fecha de atención puede diferir
        de la fecha de registro; los permisos no representan seguridad real.
      </p>

      <ol className={styles.cronologia}>
        {vista.entries.map((atencion) => (
          <AtencionDetalle key={atencion.encounterId} atencion={atencion} />
        ))}
      </ol>
    </div>
  );
}
