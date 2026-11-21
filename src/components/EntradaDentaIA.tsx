import { Icono } from "./Identidad";
import styles from "./entrada-dentaia.module.css";

const SILUETA_DIENTE = "M12 5C8 1 3 4 5 10c1 3 1 10 4 10 2 0 1-7 3-7s1 7 3 7c3 0 3-7 4-10 2-6-3-9-7-5Z";

/** Se incluye en el HTML inicial; la transición funciona sin esperar a JavaScript. */
export default function EntradaDentaIA() {
  return <div className={styles.entrada} role="status" aria-label="Bienvenido a DentaIA">
    <svg className={styles.velo} viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <mask id="dentaia-entrada-revelado" x="-100" y="-100" width="200" height="200" maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
          <rect x="-100" y="-100" width="200" height="200" fill="white" />
          <g className={styles.apertura}><path d={SILUETA_DIENTE} transform="translate(-12 -9)" fill="black" /></g>
        </mask>
      </defs>
      <rect x="-100" y="-100" width="200" height="200" fill="#087f8c" mask="url(#dentaia-entrada-revelado)" />
      <g className={styles.apertura}><path className={styles.borde} d={SILUETA_DIENTE} transform="translate(-12 -9)" vectorEffect="non-scaling-stroke" /></g>
    </svg>
    <div className={styles.escena}>
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
