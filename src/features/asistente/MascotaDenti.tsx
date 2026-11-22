import styles from "./mascota.module.css";

/** Denti: original vector tooth mascot with CSS animations. No external images or requests. */
export default function MascotaDenti({ pequeno = false, pensando = false }: { pequeno?: boolean; pensando?: boolean }) {
  return (
    <span className={[styles.escena, pequeno ? styles.pequeno : "", pensando ? styles.pensando : ""].join(" ")}
      role="img" aria-label={pensando ? "Denti está pensando" : "Denti, la mascota dental sonriente de DentaIA"}>
      <svg viewBox="0 0 112 116" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.dibujo} aria-hidden="true">
        <ellipse cx="55" cy="108" rx="34" ry="5" fill="#15394D" fillOpacity=".13"/>
        <g className={styles.piernas} stroke="#146F83" strokeWidth="5" strokeLinecap="round">
          <path d="M46 95 42 106M68 95 73 106"/>
        </g>
        <g className={styles.brazoIzq} stroke="#16839A" strokeWidth="5" strokeLinecap="round">
          <path d="M27 59 14 65 7 57"/>
        </g>
        <g className={styles.brazoDer} stroke="#16839A" strokeWidth="5" strokeLinecap="round">
          <path d="M82 58 95 47 99 36M95 47 106 46"/>
        </g>
        <path d="M57 13C44 5 27 6 20 24c-8 20 2 35 7 48 7 21 11 33 20 31 8-2 6-28 12-28 7 0 4 26 12 28 9 2 13-19 19-35 6-17 12-34 3-49C85 6 71 7 57 13Z"
          fill="url(#dentiBody)" stroke="#087D91" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M29 27C37 13 44 17 48 20" stroke="#FFF" strokeWidth="5" strokeLinecap="round" opacity=".88"/>
        <ellipse cx="38" cy="57" rx="9" ry="5" fill="#FFACBB" opacity=".8"/>
        <ellipse cx="78" cy="57" rx="9" ry="5" fill="#FFACBB" opacity=".8"/>
        <g className={styles.ojos} fill="#163951">
          <ellipse cx="44" cy="45" rx="4.2" ry="6.6"/>
          <ellipse cx="70" cy="45" rx="4.2" ry="6.6"/>
        </g>
        <path d="M46 62C52 71 64 71 71 61" stroke="#17465C" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M53 65h11" stroke="#ECAEB1" strokeWidth="2" strokeLinecap="round"/>
        <path d="M85 16 87 8l3 8 8 2-8 3-3 8-2-8-8-3 8-2Z" fill="#F8C55E"/>
        <defs><linearGradient id="dentiBody" x1="22" y1="10" x2="91" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff"/><stop offset=".6" stopColor="#E8FBFB"/><stop offset="1" stopColor="#A5E2E7"/>
        </linearGradient></defs>
      </svg>
    </span>
  );
}
