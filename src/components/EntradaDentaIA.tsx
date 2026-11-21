import { Icono } from "./Identidad";
import styles from "./entrada-dentaia.module.css";

/** Se incluye en el HTML inicial; la transición funciona sin esperar a JavaScript. */
export default function EntradaDentaIA() {
  return <div className={styles.entrada} role="status" aria-label="Bienvenido a DentaIA">
    <div className={styles.escena}>
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.identidad}>
        <div className={styles.emblema} aria-hidden="true">
          <svg className={styles.anillo} viewBox="0 0 200 200" fill="none">
            <circle className={styles.pista} cx="100" cy="100" r="87" />
            <circle className={styles.trazo} cx="100" cy="100" r="87" pathLength="1" />
          </svg>
          <div className={styles.diente}><Icono nombre="diente" size={78} /></div>
        </div>
        <h2 className={styles.marca}>Denta<span>IA</span></h2>
        <p className={styles.mensaje}>El primer paso también es cuidarte.</p>
      </div>
    </div>
  </div>;
}
