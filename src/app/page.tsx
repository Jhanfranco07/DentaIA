import Link from "next/link";
import { Icono } from "@/components/Identidad";
import Reveal from "@/components/Reveal";

const recorrido = [
  { numero: "01", icono: "diente", titulo: "Mira con más claridad", texto: "Elige un caso de referencia y explora sus observaciones educativas. Las fotografías clínicas esperan autorización verificable.", href: "/analisis/demo", accion: "Explorar los ejemplos" },
  { numero: "02", icono: "reporte", titulo: "Lleva tu guía contigo", texto: "Revisa tus recomendaciones y descarga un reporte preventivo que puedes consultar a tu ritmo.", href: "/analisis/demo", accion: "Conocer el recorrido" },
  { numero: "03", icono: "persona", titulo: "Decide tu siguiente paso", texto: "Si lo deseas, explora el directorio y prueba una solicitud de atención. Tú eliges cuándo continuar.", href: "/directorio", accion: "Encontrar odontólogo" },
] as const;

export default function Inicio() {
  return <>
    <section className="home-hero" aria-labelledby="titulo-inicio">
      <div className="home-hero-inner">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><span aria-hidden="true" /> UNA MIRADA MÁS AMABLE A TU SALUD BUCAL</span>
          <h1 id="titulo-inicio">Tu sonrisa merece<br /><span>un buen comienzo.</span></h1>
          <p className="hero-description">Entender tu cuidado dental puede ser sencillo. Explora una guía visual, llévate recomendaciones y encuentra tu próximo paso, con tranquilidad.</p>
          <div className="actions"><Link className="action" href="/analisis/demo">Explorar la demostración <Icono nombre="flecha" size={18} /></Link><Link className="action action-secondary" href="/cuenta?modo=registro">Crear mi cuenta</Link></div>
          <p className="hero-signin">¿Ya tienes una cuenta? <Link href="/cuenta">Inicia sesión <span aria-hidden="true" className="icono-enlace-externo"><Icono nombre="flecha" size={14}/></span></Link></p>
          <div className="hero-disclaimer"><span className="disclaimer-icon"><Icono nombre="escudo" size={22} /></span><span><strong>Información para cuidarte, sin diagnósticos.</strong><br />El análisis es una demostración con resultados educativos preparados. Las fotografías clínicas están pendientes de autorización.</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-decoration" aria-hidden="true" />
          <div className="hero-photo-card">
            <div className="hero-photo-heading"><span className="hero-live-label"><span aria-hidden="true" /> TU GUÍA PREVENTIVA</span><Icono nombre="diente" size={23} /></div>
            <div className="hero-photo"><img src="/demo/cuidado-habitual.jpg" alt="Tarjeta editorial del caso de cuidado habitual; fotografía clínica pendiente de autorización" width={1200} height={800} fetchPriority="high" /><span className="photo-caption">Referencia educativa · Fotografía pendiente</span></div>
            <div className="hero-photo-details"><span className="hero-detail-icon"><Icono nombre="reporte" size={24} /></span><div><span className="eyebrow">DE LA ORIENTACIÓN A TU PRÓXIMO PASO</span><h2>Una guía que puedes llevar contigo.</h2><p>Observaciones claras. Recomendaciones útiles.</p></div></div>
            <Link className="hero-card-link" href="/analisis/demo"><span>Conocer mi reporte de ejemplo</span><Icono nombre="flecha" size={19} /></Link>
          </div>
          <div className="hero-floating-note"><span className="floating-check" aria-hidden="true">✓</span><div><strong>A tu ritmo, desde el inicio</strong><span>No necesitas subir una fotografía personal.</span></div></div>
        </div>
      </div>
      <div className="home-principles" aria-label="Nuestro enfoque"><span><Icono nombre="escudo" size={19} /> Tu privacidad, primero</span><span><Icono nombre="reporte" size={19} /> Orientación comprensible</span><span><Icono nombre="persona" size={19} /> Tú decides cómo continuar</span></div>
    </section>

    <Reveal><section className="home-section" id="como-funciona" aria-labelledby="titulo-recorrido"><div className="section-heading-row"><div className="section-heading"><span className="eyebrow">UN RECORRIDO PENSADO PARA TI</span><h2 id="titulo-recorrido">Más claridad.<br /><span className="heading-muted">Un paso a la vez.</span></h2></div><p>De un caso educativo a una conversación mejor informada sobre tu cuidado dental. Sin prisas y sin decisiones obligatorias.</p></div><div className="feature-grid">
      {recorrido.map(({ numero, icono, titulo, texto, href, accion }) => <article className="surface feature-card" key={numero}><div className="feature-card-top"><span className="feature-icon"><Icono nombre={icono} size={27} /></span><span className="step-number">{numero}</span></div><h3>{titulo}</h3><p>{texto}</p><Link href={href} className="text-link">{accion} <Icono nombre="flecha" size={17} /></Link></article>)}
    </div></section></Reveal>

    <Reveal><section className="home-section home-care" aria-labelledby="titulo-espacio"><div className="care-copy"><span className="eyebrow">TU ESPACIO PERSONAL</span><h2 id="titulo-espacio">Tu cuidado, conectado.<br /><span className="heading-muted">Tus decisiones, siempre tuyas.</span></h2><p>Consulta tu perfil, guarda imágenes de prueba con tu consentimiento y sigue tus solicitudes desde un mismo lugar. La demostración educativa también está disponible sin una cuenta.</p><div className="actions"><Link href="/cuenta" className="action">Entrar a mi cuenta <Icono nombre="flecha" size={18} /></Link><Link href="/privacidad" className="text-link">Conocer la privacidad</Link></div></div><div className="personal-space"><div className="personal-space-title"><span className="feature-icon"><Icono nombre="escudo" size={26} /></span><span className="pill">CON TU CONSENTIMIENTO</span></div><h3>Un espacio para ti.</h3><p>Tú decides qué guardar y puedes retirar tu permiso.</p><div className="space-links"><Link href="/fotografias"><span><Icono nombre="diente" size={19} /> Mis fotografías</span><Icono nombre="flecha" size={18} /></Link><Link href="/solicitudes"><span><Icono nombre="reporte" size={19} /> Mis solicitudes</span><Icono nombre="flecha" size={18} /></Link></div><p className="care-caption">Guardar una fotografía no autoriza su análisis automático ni su uso para entrenar modelos.</p></div></section></Reveal>

    <Reveal><section className="home-invitation"><div><span className="eyebrow">EMPIEZA POR LA CURIOSIDAD</span><h2>Una sonrisa más informada<br />comienza con un pequeño paso.</h2><p>Tres ejemplos, una guía clara y la libertad de continuar a tu manera.</p></div><Link href="/analisis/demo" className="action">Explorar ahora <Icono nombre="flecha" size={19} /></Link></section></Reveal>
  </>;
}
