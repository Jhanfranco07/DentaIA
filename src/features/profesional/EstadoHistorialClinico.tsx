import type {
  AtencionClinica,
  AntecedenteClinico,
  EntradaClinica,
  HistorialClinico,
} from "./api-clinica";
import styles from "./profesional.module.css";

export type VistaHistorialClinico =
  | { estado: "inactivo" | "cargando"; historial: null; mensaje?: string }
  | { estado: "listo" | "vacio"; historial: HistorialClinico; mensaje?: string }
  | { estado: "denegado" | "error"; historial: null; mensaje: string };

function fechaVisible(fecha: string): string {
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(valor);
}

function textoCampo(campo: Pick<EntradaClinica, "state" | "value">): string {
  if (campo.state === "unknown") return "Información no disponible.";
  if (campo.state === "not_recorded") return "No registrado en esta atención.";
  return campo.value ?? "Información no disponible.";
}

function Campo({ titulo, campo }: { titulo: string; campo: AntecedenteClinico }) {
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>{textoCampo(campo)}</dd>
    </div>
  );
}

function Campos({
  titulo,
  campos,
}: {
  titulo: string;
  campos: EntradaClinica[];
}) {
  return (
    <div>
      <dt>{titulo}</dt>
      <dd>
        {campos.length
          ? campos.map(textoCampo).join(" · ")
          : "No registrado en esta atención."}
      </dd>
    </div>
  );
}

function Atencion({ atencion, indice }: { atencion: AtencionClinica; indice: number }) {
  const examenesId = `examenes-clinicos-${indice}`;

  return (
    <li className={styles.itemCronologia}>
      <article className={styles.atencion}>
        <header className={styles.cabeceraAtencion}>
          <div>
            <p className={styles.fechaAtencion}>
              <time dateTime={atencion.attendedAt}>
                {fechaVisible(atencion.attendedAt)}
              </time>
            </p>
            <h3>Atención clínica autorizada</h3>
          </div>
          <span className={styles.identificador}>
            {atencion.status === "voided" ? "Anulada" : "Registrada"}
          </span>
        </header>

        <dl className={styles.procedencia}>
          <div>
            <dt>Profesional responsable</dt>
            <dd>{atencion.origin.professionalName ?? "No disponible"}</dd>
          </div>
          <div>
            <dt>Clínica de origen</dt>
            <dd>{atencion.origin.clinicName}</dd>
          </div>
          <div>
            <dt>Registrado el</dt>
            <dd>
              <time dateTime={atencion.recordedAt}>
                {fechaVisible(atencion.recordedAt)}
              </time>
            </dd>
          </div>
        </dl>

        <details className={styles.detalleAtencion}>
          <summary>Ver detalle de la atención</summary>
          <dl className={styles.detalleClinico}>
            <Campo titulo="Antecedentes" campo={atencion.background} />
            <Campos titulo="Diagnósticos" campos={atencion.diagnoses} />
            <Campos titulo="Tratamientos" campos={atencion.treatments} />
          </dl>

          {atencion.correctionReason && (
            <p className={styles.ayudaResultado}>
              Corrección registrada: {atencion.correctionReason}
            </p>
          )}

          {atencion.clinicalEntries.length > 0 && (
            <section aria-labelledby={`entradas-clinicas-${indice}`}>
              <h4 id={`entradas-clinicas-${indice}`}>Entradas clínicas registradas</h4>
              <ul className={styles.listaExamenes}>
                {atencion.clinicalEntries.map((entrada) => (
                  <li key={entrada.id} className={styles.referenciaExamen}>
                    <strong>
                      {entrada.kind === "background"
                        ? "Antecedente"
                        : entrada.kind === "diagnosis"
                          ? "Diagnóstico"
                          : "Tratamiento"}
                    </strong>
                    <span>{textoCampo(entrada)}</span>
                    <span>
                      Registrado: {fechaVisible(entrada.recordedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby={examenesId}>
            <h4 id={examenesId}>Exámenes y documentos</h4>
            {atencion.exams.length === 0 ? (
              <p className={styles.ayudaResultado}>
                No hay referencias de exámenes para esta atención.
              </p>
            ) : (
              <ul className={styles.listaExamenes}>
                {atencion.exams.map((examen) => (
                  <li key={examen.id} className={styles.referenciaExamen}>
                    <strong>{examen.title}</strong>
                    {examen.examDate && <span>Fecha: {examen.examDate}</span>}
                    <span>
                      {examen.availability === "available"
                        ? "Referencia disponible; esta vista no descarga archivos."
                        : "Referencia no disponible."}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </details>
      </article>
    </li>
  );
}

export default function EstadoHistorialClinico({
  vista,
}: {
  vista: VistaHistorialClinico;
}) {
  if (vista.estado === "inactivo") {
    return (
      <div className={styles.estadoVacio} role="status">
        Selecciona una clínica y un paciente autorizado para consultar el
        historial.
      </div>
    );
  }

  if (vista.estado === "cargando") {
    return (
      <div className={styles.estadoCarga} role="status" aria-live="polite">
        Cargando historial clínico autorizado…
      </div>
    );
  }

  if (vista.estado === "denegado") {
    return (
      <div className={styles.estadoDenegado} role="alert">
        <strong>Acceso restringido.</strong>
        <p>{vista.mensaje}</p>
      </div>
    );
  }

  if (vista.estado === "error") {
    return (
      <div className={styles.estadoError} role="alert">
        <strong>No se pudo cargar el historial clínico.</strong>
        <p>{vista.mensaje}</p>
      </div>
    );
  }

  const historial = vista.historial;

  if (!historial || vista.estado === "vacio" || historial.entries.length === 0) {
    return (
      <div className={styles.estadoVacio} role="status">
        No hay atenciones autorizadas para este paciente y contexto clínico.
      </div>
    );
  }

  return (
    <div className={styles.resultadoHistorial}>
      <header className={styles.resumenCaso}>
        <div>
          <p className={styles.etiquetaResultado}>
            HISTORIAL AUTORIZADO · SOLO LECTURA
          </p>
          <h3>Paciente autorizado</h3>
        </div>
        <dl>
          <div>
            <dt>Contexto profesional</dt>
            <dd>Verificado por el servidor</dd>
          </div>
          <div>
            <dt>Clínica de contexto</dt>
            <dd>Verificada por el servidor</dd>
          </div>
        </dl>
      </header>

      <p className={styles.ayudaResultado}>
        Solo se muestran registros incluidos en una autorización vigente. La
        procedencia de cada atención se conserva en la cronología.
      </p>

      <ol className={styles.cronologia}>
        {historial.entries.map((atencion, indice) => (
          <Atencion
            key={atencion.encounterId}
            atencion={atencion}
            indice={indice}
          />
        ))}
      </ol>
    </div>
  );
}
