import { ARCADA_INFERIOR, ARCADA_SUPERIOR, CATALOGO, type Fdi, type Registro } from "./modelo";
import styles from "./odontograma.module.css";

function Anatomia({ tooth }: { tooth: Fdi }) {
  const position = tooth % 10;
  const crown = position <= 2
    ? "M13 29 Q18 24 23 29 L24 42 Q18 45 12 42 Z"
    : position === 3 ? "M12 31 L18 25 L24 31 L24 41 Q18 45 12 41 Z"
      : position <= 5 ? "M10 31 Q11 25 18 25 Q25 25 26 31 L25 41 Q18 46 11 41 Z"
        : "M7 30 Q10 24 14 26 Q18 22 22 26 Q28 24 29 30 L28 40 Q24 46 18 43 Q12 46 8 40 Z";
  const root = position <= 5
    ? "M13 30 Q12 22 15 10 Q18 1 20 10 Q23 23 23 30"
    : "M9 31 Q8 16 12 8 Q14 5 15 11 L18 24 L21 11 Q24 5 26 10 Q30 21 27 31";
  return <svg viewBox="0 0 36 48" aria-hidden="true" focusable="false" className={styles.toothSvg}>
    <g transform={tooth > 30 ? "rotate(180 18 24)" : undefined}>
      <path d={root} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d={crown} fill="var(--panel-bg, var(--surface, transparent))" stroke="currentColor" strokeWidth="1.5" />
      {position > 5 && <path d="M12 34 L24 34 M18 29 L18 40" stroke="currentColor" fill="none" />}
    </g>
  </svg>;
}

export function Arcadas({ selected, records, select }: {
  selected: Fdi; records: Registro[]; select: (fdi: Fdi) => void;
}) {
  return <div className={styles.arches} aria-label="Dentición permanente FDI">
    <p className={styles.orientation}><span>Derecha del paciente</span><span>Izquierda del paciente</span></p>
    {[ARCADA_SUPERIOR, ARCADA_INFERIOR].map((arch, idx) => <section key={idx} className={styles.arch}>
      <h4>{idx === 0 ? "Arcada superior" : "Arcada inferior"}</h4>
      <div className={styles.quadrants}>
        {[arch.slice(0, 8), arch.slice(8)].map((quadrant, side) => <div className={styles.teeth} key={side}>
          {quadrant.map(tooth => {
            const statuses = [...new Set(records.filter(record => record.tooth === tooth && record.active).map(record => record.condition))];
            return <button key={tooth} type="button" className={styles.tooth} aria-pressed={tooth === selected}
              aria-label={`Pieza ${tooth}: ${statuses.map(s => CATALOGO[s].etiqueta).join(", ") || "Sin registro"}`}
              data-recorded={statuses.length > 0} onClick={() => select(tooth)}>
              <Anatomia tooth={tooth} />
              <strong>{tooth}</strong>
              <span aria-hidden="true">{statuses.length ? statuses.slice(0, 3).map(s => CATALOGO[s].simbolo).join(" ") : "·"}</span>
            </button>;
          })}
        </div>)}
      </div>
    </section>)}
    <details className={styles.legend}><summary>Leyenda de estados</summary>
      <ul><li>· Sin registro</li>{Object.values(CATALOGO).map(s => <li key={s.simbolo}>{s.simbolo} · {s.etiqueta}</li>)}</ul>
    </details>
  </div>;
}
