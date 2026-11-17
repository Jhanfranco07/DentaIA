import Link from "next/link";
import { PLAN_PREMIUM_MENSUAL } from "@/lib/stripe/plan";
import styles from "./planes-dentaia.module.css";

const precio = (PLAN_PREMIUM_MENSUAL.amount / 100).toFixed(2);
const gratis = ["Evaluación básica de la sonrisa", "Solicitudes de análisis limitadas", "Detección orientativa de coloración amarillenta y alineación dental"];
const premium = ["Todo lo incluido en Gratis", "Más tipos de evaluaciones dentales (en desarrollo)", "Mayor capacidad de solicitudes cuando se habilite", "Historial y seguimiento ampliados (en desarrollo)"];

export default function PlanesDentaIA() {
  return <section className={styles.section} id="planes" aria-labelledby="planes-titulo">
    <div className={styles.intro}>
      <span className={styles.eyebrow}>PLANES DENTAIA</span>
      <h2 id="planes-titulo">Tu sonrisa merece más opciones.</h2>
      <p>Empieza gratis y, cuando quieras explorar más posibilidades, descubre Premium. Elige el plan que mejor se adapte a ti.</p>
    </div>
    <div className={styles.grid}>
      <article className={styles.card}>
        <span className={styles.kicker}>PARA EMPEZAR</span>
        <h3>Gratis</h3>
        <div className={styles.price}>S/ 0 <small>/ siempre</small></div>
        <p>Conoce las herramientas esenciales de DentaIA.</p>
        <ul>{gratis.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
        <Link className={styles.secondaryButton} href="/cuenta?modo=registro">Comenzar gratis <span aria-hidden="true">→</span></Link>
      </article>
      <article className={styles.featured}>
        <span className={styles.badge}>✦ Recomendado</span>
        <span className={styles.kicker}>UNA EXPERIENCIA MÁS COMPLETA</span>
        <h3>Premium</h3>
        <div className={styles.price}>S/ {precio} <small>/ mes</small></div>
        <p>Más oportunidades para explorar y dar seguimiento a tu salud bucal.</p>
        <ul>{premium.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
        <Link className={styles.primaryButton} href="/cuenta?modo=registro&continuar=%2Fpremium">Elegir Premium <span aria-hidden="true">→</span></Link>
      </article>
    </div>
    <div className={styles.details}>
      <h3>Compara lo que incluye cada plan</h3>
      <div className={styles.scroll}>
        <table>
          <thead><tr><th scope="col">Funcionalidad</th><th scope="col">Gratis</th><th scope="col">Premium</th></tr></thead>
          <tbody>
            <tr><th scope="row">Análisis dental básico</th><td>Incluido*</td><td>Incluido*</td></tr>
            <tr><th scope="row">Coloración amarillenta y alineación dental</th><td>Alcance inicial*</td><td>Alcance inicial*</td></tr>
            <tr><th scope="row">Cantidad de solicitudes</th><td>Limitada</td><td>Ampliación prevista</td></tr>
            <tr><th scope="row">Más tipos de evaluaciones</th><td>—</td><td>En desarrollo</td></tr>
            <tr><th scope="row">Historial y seguimiento ampliado</th><td>—</td><td>En desarrollo</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div className={styles.steps}>
      <h3>¿Cómo funciona?</h3>
      <ol>
        <li><strong>1. Regístrate o inicia sesión</strong><span>Tu cuenta de paciente protege tus datos.</span></li>
        <li><strong>2. Completa la contratación</strong><span>Stripe Sandbox procesa la suscripción de prueba.</span></li>
        <li><strong>3. Vuelve a DentaIA</strong><span>El plan se activa tras confirmación del webhook.</span></li>
      </ol>
    </div>
    <p className={styles.disclaimer}>* Las evaluaciones automatizadas y las funcionalidades Premium avanzadas todavía están en desarrollo: esta comparación describe el alcance previsto, no funciones clínicas ya disponibles. Stripe opera en entorno Sandbox, sin cobros reales. Los resultados orientativos no sustituyen la atención odontológica.</p>
  </section>;
}
