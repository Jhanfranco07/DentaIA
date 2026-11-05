import type { VistaResultadosEducativos } from "./resultados-educativos-interfaz";
import styles from "./profesional.module.css";

export default function EstadoResultadosEducativos({
  vista,
}: {
  vista: VistaResultadosEducativos;
}) {
  if (vista.estado === "cargando") {
    return (
      <div className={styles.estadoCarga} role="status" aria-live="polite">
        Cargando material educativo de demostración…
      </div>
    );
  }

  if (vista.estado === "vacio") {
    return (
      <div className={styles.estadoVacio} role="status">
        No hay material educativo sintético disponible para este escenario de
        demostración.
      </div>
    );
  }

  if (vista.estado === "denegado") {
    return (
      <div className={styles.estadoDenegado} role="alert">
        <strong>El material educativo no está disponible.</strong>
        <p>No se muestra contenido ni se infiere información clínica.</p>
      </div>
    );
  }

  if (vista.estado === "error") {
    return (
      <div className={styles.estadoError} role="alert">
        <strong>No se pudo cargar el material educativo.</strong>
        <p>La demostración no muestra contenido alternativo ni datos clínicos.</p>
      </div>
    );
  }

  if (!vista.resultado) {
    return null;
  }

  const { resultado } = vista;

  return (
    <article
      className={styles.resultadoEducativo}
      aria-labelledby="titulo-resultado-educativo"
    >
      <p className={styles.etiquetaResultado}>
        CONTENIDO EDUCATIVO SINTÉTICO · DEMOSTRACIÓN
      </p>
      <h3 id="titulo-resultado-educativo">{resultado.titulo}</h3>

      <section aria-labelledby="observaciones-educativas">
        <h4 id="observaciones-educativas">Contexto educativo</h4>
        <ul className={styles.listaEducativa}>
          {resultado.observaciones.map((observacion) => (
            <li key={observacion}>{observacion}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recomendaciones-educativas">
        <h4 id="recomendaciones-educativas">
          Recomendaciones educativas generales
        </h4>
        <ul className={styles.listaEducativa}>
          {resultado.recomendaciones.map((recomendacion) => (
            <li key={recomendacion}>{recomendacion}</li>
          ))}
        </ul>
      </section>

      <p className={styles.avisoEducativo}>{resultado.aviso}</p>
      <dl className={styles.fuenteEducativa}>
        <div>
          <dt>Fuente</dt>
          <dd>{resultado.fuente.nombre}</dd>
        </div>
        {resultado.fuente.atribucion && (
          <div>
            <dt>Atribución</dt>
            <dd>{resultado.fuente.atribucion}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}
