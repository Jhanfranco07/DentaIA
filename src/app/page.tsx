import Link from "next/link";
import { Icono } from "@/components/Identidad";
export default function Inicio() {
  return <>
    <section className="home-hero"><div className="home-hero-inner"><div>
      <span className="eyebrow">ORIENTACIÓN BUCAL PARA TI</span><h1>Tu sonrisa merece<br /><span>un buen comienzo.</span></h1>
      <p className="hero-description">Conoce hábitos de cuidado, explora una guía dental ilustrativa y encuentra el siguiente paso para ti. Información clara para tomar decisiones con más tranquilidad.</p>
      <div className="actions"><Link className="action" href="/analisis/demo">Explorar la demostración <Icono nombre="flecha" size={18} /></Link><Link className="action action-secondary" href="/directorio">Encontrar odontólogo</Link></div>
      <p className="hero-signin">¿Primera visita? <Link href="/cuenta?modo=registro">Crea tu cuenta</Link> o <Link href="/cuenta">inicia sesión</Link>.</p>
      <div className="hero-disclaimer"><Icono nombre="escudo" size={21} /><span>Demostración con imágenes de ejemplo.<br /><strong>No es un diagnóstico médico.</strong></span></div>
    </div><div className="hero-illustration"><div className="hero-illustration-top"><span className="pill">TU RECORRIDO, PASO A PASO</span><span className="muted">DentaIA</span></div>
      <img src="/demo/cuidado-habitual.svg" alt="Ilustración original de una dentadura de ejemplo, sin datos de pacientes" width={1400} height={840} />
      <div className="hero-guide"><Icono /><div><strong>Una sonrisa más informada</strong><p>Elige un ejemplo y descubre una guía educativa.</p></div></div>
      <div className="mini-steps"><span><b>01</b> Explora</span><span><b>02</b> Aprende</span><span><b>03</b> Consulta</span></div>
    </div></div></section>
    <section className="home-section" id="como-funciona"><div className="section-heading"><span className="eyebrow">ASÍ TE ACOMPAÑAMOS</span><h2>Un siguiente paso más claro.</h2><p>No necesitas conocimientos técnicos. Empieza por lo que te interesa.</p></div><div className="feature-grid">
      {[
        ["01","Explora un ejemplo","Selecciona una de las tres ilustraciones dentales y consulta su resultado educativo preparado.","/analisis/demo","Ver los ejemplos"],
        ["02","Lleva tu guía contigo","Descarga un reporte ilustrativo con recomendaciones y temas que puedes conversar con tu odontólogo.","/analisis/demo","Conocer el reporte"],
        ["03","Encuentra atención","Explora profesionales y solicitudes de demostración. Los perfiles y precios están identificados como ficticios.","/directorio","Ver odontólogos"],
      ].map(([numero,titulo,texto,href,accion])=><article className="surface feature-card" key={numero}><span className="step-number">{numero}</span><h3>{titulo}</h3><p>{texto}</p><Link href={href} className="text-link">{accion} <span aria-hidden="true">→</span></Link></article>)}
    </div></section>
    <section className="home-section home-care"><div><span className="eyebrow">TU ESPACIO PERSONAL</span><h2>Tus fotografías y solicitudes,<br />en un solo lugar.</h2><p>Inicia sesión para consultar tu perfil, guardar imágenes de prueba con tu permiso y seguir tus solicitudes. La demostración educativa también se puede explorar sin una cuenta.</p><div className="actions"><Link href="/cuenta" className="action">Entrar a mi cuenta</Link><Link href="/privacidad" className="text-link">Conocer la privacidad</Link></div></div><div className="care-note"><Icono nombre="escudo" size={36} /><h3>Tú decides qué guardar.</h3><p>El guardado de fotografías requiere tu consentimiento. No autoriza su análisis automático ni su uso para entrenar modelos.</p></div></section>
  </>;
}
