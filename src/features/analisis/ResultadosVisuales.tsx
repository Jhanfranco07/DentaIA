"use client";

import Link from "next/link";
import type { OralBasicAnalysis, SmileExplanation, SmileResult } from "./smile-contract";
import styles from "./resultados-visuales.module.css";

type Props = {
  result: SmileResult;
  oral: OralBasicAnalysis | null;
  image: string;
  smileOverlay: string;
  explanation: SmileExplanation | null;
  explaining: boolean;
  onNewPhoto: () => void;
};

function compartirOrientacion(result: SmileResult, oral: OralBasicAnalysis | null) {
  window.dispatchEvent(new CustomEvent("dentaia:asistente-resultado", { detail: {
    evaluable: result.status !== "not_evaluable",
    variacionesColor: result.regions.filter(r => r.evaluable && (r.partial || r.level !== "Sin amarillo destacado")).length,
    posiblesAusencias: oral?.status === "evaluated" ? oral.detections.filter(d => d.class === "toothLoss").length : 0,
    posiblesApiñamientos: oral?.status === "evaluated" ? oral.detections.filter(d => d.class === "dentalCrowding").length : 0,
  } }));
}

function plural(total: number, singular: string, pluralValue: string) {
  return total === 1 ? singular : pluralValue;
}

export default function ResultadosVisuales({ result, oral, image, smileOverlay, explanation, explaining, onNewPhoto }: Props) {
  const observed = result.regions.filter(r => r.evaluable && (r.partial || r.level !== "Sin amarillo destacado")).length;
  const missing = oral?.detections.filter(d => d.class === "toothLoss").length ?? 0;
  const crowding = oral?.detections.filter(d => d.class === "dentalCrowding").length ?? 0;
  const coverage = result.detected_regions ? Math.round((result.evaluable_regions / result.detected_regions) * 100) : null;
  const needsLight = result.lighting_quality !== "adequate";
  const colorHeading = result.status === "not_evaluable"
    ? "Necesitamos una fotografía más clara"
    : observed
      ? `${observed} ${plural(observed, "región con amarillo destacado", "regiones con amarillo destacado")}`
      : "Sin amarillo destacado en las regiones evaluables";

  return <div className={styles.dashboard}>
    <header className={styles.intro}>
      <div>
        <span className={styles.eyebrow}>TU EVALUACIÓN VISUAL</span>
        <h1>Resultado de tu sonrisa</h1>
        <p>Dos observaciones independientes, explicadas de forma sencilla.</p>
        <button type="button" onClick={() => compartirOrientacion(result, oral)} style={{ marginTop: 14, borderRadius: 12, padding: "12px 16px", border: "1px solid #087e86", background: "#e7f7f7", color: "#006c74", fontWeight: 700, cursor: "pointer" }}>✦ Consultar al asistente sobre estas observaciones</button>
      </div>
      <span className={styles.status}>Análisis orientativo</span>
    </header>

    <section className={styles.analysisCard} aria-labelledby="resultado-color-titulo">
      <div className={styles.cardHeading}>
        <span className={styles.number}>01</span>
        <div><p className={styles.kicker}>TONALIDAD DENTAL</p><h2 id="resultado-color-titulo">Color de tus dientes</h2></div>
        <span className={styles.modelLabel}>Smile V17</span>
      </div>
      <div className={styles.contentGrid}>
        <figure className={styles.photo}>
          <img src={smileOverlay || image} alt={smileOverlay ? "Fotografía con regiones dentales y diferencias de tonalidad resaltadas" : "Fotografía dental analizada"} />
          <figcaption>Las líneas muestran regiones identificadas por el modelo, no un diagnóstico.</figcaption>
        </figure>
        <div className={styles.findings}>
          <span className={styles.findingsIcon} aria-hidden="true">✦</span>
          <p className={styles.findingsEyebrow}>RESULTADO PRINCIPAL</p>
          <h3>{colorHeading}</h3>
          <p className={styles.description}>{result.status === "not_evaluable" ? "La iluminación o la fotografía no permiten revisar la tonalidad con suficiente claridad." : "Se observan diferencias de color visibles en esta imagen. Las regiones detectadas no equivalen necesariamente a dientes afectados."}</p>
          <div className={styles.stats}>
            <div><span>Regiones revisadas</span><strong>{result.evaluable_regions} / {result.detected_regions}</strong></div>
            <div><span>Iluminación</span><strong>{needsLight ? "Revisar foto" : "Adecuada"}</strong></div>
          </div>
          {coverage !== null && <div className={styles.coverage}>
            <div><span>Cobertura evaluable de la fotografía</span><strong>{coverage}%</strong></div>
            <div className={styles.track} role="progressbar" aria-valuenow={coverage} aria-valuemin={0} aria-valuemax={100} aria-label="Porcentaje de regiones detectadas que pudieron evaluarse"><span style={{width:`${coverage}%`}} /></div>
            <small>Indica qué parte de las regiones detectadas pudo evaluarse; no es precisión ni confianza diagnóstica.</small>
          </div>}
        </div>
      </div>
      <div className={styles.cardFooter}><span>Interpretación visual, no clínica.</span><Link href="/paciente/buenas-practicas" className={styles.textLink}>Ver buenas prácticas para el cuidado dental <span aria-hidden="true">↗</span></Link></div>
    </section>

    <section className={styles.analysisCard} aria-labelledby="resultado-posicion-titulo">
      <div className={styles.cardHeading}>
        <span className={styles.number}>02</span>
        <div><p className={styles.kicker}>ESTRUCTURA VISIBLE</p><h2 id="resultado-posicion-titulo">Posición y posibles ausencias dentales</h2></div>
        <span className={styles.modelLabel}>Oral Disease Union</span>
      </div>
      <div className={styles.contentGrid}>
        <figure className={styles.photo}>
          <img src={oral?.overlay_url || image} alt={oral?.overlay_url ? "Fotografía con zonas de posible ausencia dental o apiñamiento señaladas mediante recuadros" : "Fotografía dental sin recuadros de detección estructural"} />
          <figcaption>Los recuadros señalan zonas para revisión profesional, no hallazgos confirmados.</figcaption>
        </figure>
        <div className={styles.findings}>
          <span className={styles.findingsIcon} aria-hidden="true">◎</span>
          <p className={styles.findingsEyebrow}>OBSERVACIÓN DE POSICIÓN</p>
          {oral?.status === "evaluated" ? <>
            <h3>{missing || crowding ? "Encontramos zonas para revisar" : "Sin zonas señaladas por el detector"}</h3>
            <div className={styles.findingList}>
              <div><span>Posible ausencia dental</span><strong>{missing} {plural(missing, "zona", "zonas")}</strong></div>
              <div><span>Posible apiñamiento</span><strong>{crowding} {plural(crowding, "zona", "zonas")}</strong></div>
            </div>
            <p className={styles.description}>{explanation?.oral_summary ?? (missing || crowding ? "El detector marcó posibles irregularidades en la fotografía. Un odontólogo debe confirmar cualquier hallazgo." : "No se marcaron zonas por encima del umbral del modelo. Esto no descarta alteraciones dentales.")}</p>
            <small className={styles.hint}>Las cantidades corresponden a detecciones del modelo, no necesariamente a dientes distintos.</small>
          </> : <>
            <h3>{oral?.status === "unavailable" ? "Análisis temporalmente no disponible" : "Análisis de posición no incluido"}</h3>
            <p className={styles.description}>El análisis de color se completó por separado. Puedes intentarlo con otra fotografía.</p>
          </>}
        </div>
      </div>
      <div className={styles.cardFooter}><span>Esta detección es experimental.</span><Link href="/panel/odontologos" className={styles.textLink}>Consultar un odontólogo <span aria-hidden="true">↗</span></Link></div>
    </section>

    <section className={styles.explanationCard} aria-labelledby="orientacion-titulo" aria-live="polite">
      <div className={styles.explanationHeader}><div><span className={styles.eyebrow}>INTERPRETACIÓN EDUCATIVA</span><h2 id="orientacion-titulo">Entiende tus resultados</h2></div><span className={styles.modelLabel}>{explanation?.source === "openai" ? "Explicación con IA" : "Orientación"}</span></div>
      <p>{explanation?.summary ?? (explaining ? "Estamos preparando una explicación con los datos del análisis…" : "Tu fotografía se ha analizado; consulta las observaciones anteriores.")}</p>
      {explanation?.recommendation && <p>{explanation.recommendation}</p>}
      <div className={styles.educationActions}>
        <Link href="/paciente/buenas-practicas" className={styles.primaryLink}>Conocer buenas prácticas <span aria-hidden="true">↗</span></Link>
        <Link href="/panel/odontologos" className={styles.secondaryLink}>Buscar odontólogo</Link>
      </div>
      <small>{explanation?.disclaimer ?? "El resultado es orientativo y no constituye diagnóstico. No confirma una condición dental."}</small>
    </section>

    <aside className={styles.premiumCard} aria-label="Próximas funciones Premium">
      <div><span className={styles.premiumPill}>PREPARADO PARA PREMIUM · PRÓXIMAMENTE</span><h2>Una visión más detallada de tu sonrisa</h2><p>Estamos preparando comparaciones visuales por región y explicaciones ampliadas. Las métricas futuras deberán indicar claramente qué miden y cómo se validaron, sin confundir confianza del modelo con precisión clínica.</p></div>
      <Link href="/premium" className={styles.premiumLink}>Conocer el plan Premium <span aria-hidden="true">↗</span></Link>
    </aside>

    <div className={styles.bottomBar}>
      <button type="button" className={styles.newPhoto} onClick={onNewPhoto}>↻ Analizar otra fotografía</button>
      <span>La luz, las sombras y los filtros pueden influir en los resultados.</span>
    </div>
  </div>;
}
