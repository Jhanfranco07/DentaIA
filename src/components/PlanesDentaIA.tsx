import Link from "next/link";
import { PLAN_PREMIUM_MENSUAL } from "@/lib/stripe/plan";
import { Icono } from "./Identidad";
import AperturaPlanes from "./AperturaPlanes";
import styles from "./planes-dentaia.module.css";

const precio = (PLAN_PREMIUM_MENSUAL.amount / 100).toFixed(2);
const comparacion = [
  ["Análisis dental básico", "En desarrollo", "En desarrollo"],
  ["Evaluación de coloración y alineación", "Alcance previsto", "Alcance previsto"],
  ["Solicitudes de análisis", "Límite previsto", "Ampliación prevista"],
  ["Más tipos de evaluaciones", "—", "En desarrollo"],
  ["Historial y seguimiento ampliado", "—", "En desarrollo"],
];

export default function PlanesDentaIA() {
  return <section className={styles.section} id="planes" aria-labelledby="planes-titulo">
    <div className={`${styles.layout} public-wrap`}>
    <div className={styles.intro} data-reveal>
      <p className="public-label">Planes DentaIA</p>
      <h2 className="public-title" id="planes-titulo">Empieza gratis, explora Premium</h2>
      <p>Elige según lo que necesitas hoy y consulta qué funciones están previstas para cada plan.</p>
    </div>
    <AperturaPlanes className={styles.grid}>
      <div className={styles.cardSlot}>
      <article className={styles.card}>
        <h3>Gratis</h3>
        <p className={styles.price}>S/ 0 <small>/ siempre</small></p>
        <p>Accede a las herramientas esenciales de DentaIA.</p>
        <ul>
          <li><Icono nombre="check" size={18} /> Cuenta y espacio personal del paciente</li>
          <li><Icono nombre="check" size={18} /> Directorio odontológico y preparación local de fotografías</li>
          <li><Icono nombre="reloj" size={18} /> Evaluación básica y solicitudes de análisis limitadas, en desarrollo</li>
        </ul>
        <Link className="action action-secondary" href="/cuenta?modo=registro">Comenzar gratis <Icono nombre="flecha" size={16} /></Link>
      </article>
      </div>
      <div className={styles.cardSlot}>
      <article className={`${styles.card} ${styles.featured} public-inverse`}>
        <h3>Premium</h3>
        <p className={styles.price}>S/ {precio} <small>/ mes</small></p>
        <p>Suscripción de demostración con Stripe Sandbox.</p>
        <ul>
          <li><Icono nombre="check" size={18} /> Todo lo incluido en Gratis</li>
          <li><Icono nombre="reloj" size={18} /> Más tipos de evaluaciones y mayor capacidad de solicitudes, en desarrollo</li>
          <li><Icono nombre="reloj" size={18} /> Historial y seguimiento ampliados, en desarrollo</li>
        </ul>
        <Link className="action" href="/premium?iniciar=1">Elegir Premium <Icono nombre="flecha" size={16} /></Link>
        <small className={styles.nota}>Pago de prueba. Stripe Sandbox no realiza cobros reales.</small>
      </article>
      </div>
    </AperturaPlanes>
    <div className={styles.details} data-reveal>
      <h3 id="planes-comparacion">Compara los planes</h3>
      <table aria-labelledby="planes-comparacion">
        <thead><tr><th scope="col">Función</th><th scope="col">Gratis</th><th scope="col">Premium</th></tr></thead>
        <tbody>{comparacion.map(([funcion, gratis, premium]) => <tr key={funcion}><th scope="row">{funcion}</th><td>{gratis}</td><td>{premium}</td></tr>)}</tbody>
      </table>
    </div>
    <div className={styles.steps} data-reveal>
      <h3>Cómo probar Premium</h3>
      <ol>
        <li>Regístrate o inicia sesión con tu cuenta de paciente.</li>
        <li>Si te registras, confirma tu correo y continúa al pago de prueba.</li>
        <li>Vuelve a DentaIA. El plan se activa tras la confirmación del pago de prueba.</li>
      </ol>
      <p className={styles.nota}>Las evaluaciones automatizadas están en desarrollo y no sustituyen la atención odontológica.</p>
    </div>
    </div>
  </section>;
}
