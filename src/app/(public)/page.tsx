import Image from "next/image";
import Link from "next/link";
import HeroCarousel from "@/components/HeroCarousel";
import EntradaDentaIA from "@/components/EntradaDentaIA";
import { Icono, type NombreIcono } from "@/components/Identidad";
import LandingMotion from "@/components/LandingMotion";
import PlanesDentaIA from "@/components/PlanesDentaIA";
import styles from "./home.module.css";

const pasos = [
  { titulo: "Crea tu cuenta", texto: "Regístrate y confirma tu correo para abrir tu espacio personal." },
  { titulo: "Organiza tu cuidado", texto: "Completa tu perfil y consulta tus fotografías de prueba y tus solicitudes en el panel." },
  { titulo: "Prepara tu próxima consulta", texto: "Busca un odontólogo y revisa qué incluye una solicitud de orientación antes de enviarla." },
];

const herramientas = [
  { titulo: "Tu espacio personal", icono: "persona", texto: "Organiza tus fotografías de prueba y revisa tus solicitudes desde el panel del paciente.", enlace: "Ir a mi panel", href: "/panel" },
  { titulo: "Preparación de fotografías", icono: "camara", texto: "Captura o selecciona una fotografía y revísala en tu dispositivo. El análisis con IA está en desarrollo.", enlace: "Conocer la preparación", href: "/analisis" },
  { titulo: "Espacio profesional", icono: "clinica", texto: "Los odontólogos autorizados pueden consultar clínicas, solicitudes e historial según sus permisos.", enlace: "Acceder como profesional", href: "/profesional" },
] satisfies { titulo: string; icono: NombreIcono; texto: string; enlace: string; href: string }[];

function VistaPanel() {
  return (
    <figure className={styles.preview} aria-label="Vista ilustrativa del panel del paciente">
      <div className={styles.previewBar}>
        <span><Icono nombre="diente" size={18} /> DentaIA</span>
        <span>Vista del panel</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewNav}>
          <span><Icono nombre="casa" size={16} /> Mi panel</span>
          <span><Icono nombre="camara" size={16} /> Fotografías</span>
          <span><Icono nombre="ubicacion" size={16} /> Odontólogos</span>
          <span><Icono nombre="calendario" size={16} /> Solicitudes</span>
        </div>
        <div className={styles.previewMain}>
          <div>
            <p>Tu espacio personal</p>
            <strong>Prepara una fotografía</strong>
          </div>
          <div className={styles.previewPhoto}>
            <Image src="/landing/fotografia.webp" alt="" fill sizes="(max-width: 760px) 84vw, 420px" />
            <span className="public-viewfinder" aria-hidden="true" />
          </div>
          <p className={styles.previewCaption}><Icono nombre="escudo" size={16} /> Revisión en tu dispositivo</p>
        </div>
      </div>
    </figure>
  );
}

export default function Home() {
  return <>
    <EntradaDentaIA />
    <LandingMotion />
    <HeroCarousel />

    <section className={styles.recorrido} id="como-funciona" aria-labelledby="como-titulo">
      <div className={`${styles.recorridoInner} public-wrap`}>
        <div data-reveal>
          <p className="public-label">Cómo funciona</p>
          <h2 className="public-title" id="como-titulo">De tu cuenta a tu próxima consulta</h2>
          <Link href="/cuenta?modo=registro" className="text-link">Abre tu cuenta <Icono nombre="flecha" size={18} /></Link>
        </div>
        <ol className={styles.pasos} role="list" data-reveal>
          {pasos.map(({ titulo, texto }, index) => (
            <li key={titulo}>
              <span aria-hidden="true">0{index + 1}</span>
              <div><h3>{titulo}</h3><p>{texto}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>

    <section className={`${styles.funciones} public-inverse`} id="funcionalidades" aria-labelledby="funciones-titulo">
      <div className="public-wrap">
        <div className={styles.funcionesIntro} data-reveal>
          <p className="public-label">Funcionalidades</p>
          <h2 className="public-title" id="funciones-titulo">Tu cuidado dental, <span>mejor organizado</span></h2>
        </div>
        <div className={styles.funcionesGrid}>
          <div className={styles.herramientas} data-reveal>
            {herramientas.map(herramienta => (
              <article key={herramienta.href}>
                <Icono nombre={herramienta.icono} size={18} />
                <div>
                  <h3>{herramienta.titulo}</h3>
                  <p>{herramienta.texto}</p>
                  <Link className="text-link" href={herramienta.href}>{herramienta.enlace} <Icono nombre="flecha" size={16} /></Link>
                </div>
              </article>
            ))}
          </div>
          <VistaPanel />
        </div>
      </div>
    </section>

    <section className={styles.directorio} aria-labelledby="directorio-titulo">
      <div className={styles.directorioFoto}>
        <Image src="/landing/equipo.webp" alt="" fill sizes="(max-width: 760px) 100vw, 52vw" />
      </div>
      <div className={styles.directorioCopy} data-reveal>
        <p className="public-label">Directorio odontológico</p>
        <h2 className="public-title" id="directorio-titulo">Encuentra orientación cerca de ti</h2>
        <p>Busca por especialidad o distrito, revisa los perfiles y consulta en el mapa las ubicaciones publicadas.</p>
        <Link href="/directorio" className="action">Explorar el directorio <Icono nombre="flecha" size={18} /></Link>
      </div>
    </section>

    <section className={styles.privacidad} aria-labelledby="privacidad-titulo">
      <div className={`${styles.privacidadInner} public-wrap`}>
        <div data-reveal>
          <p className="public-label">Privacidad y consentimiento</p>
          <h2 className="public-title" id="privacidad-titulo">Tú decides qué compartir</h2>
          <Link href="/privacidad" className="text-link">Conocer la política de privacidad <Icono nombre="flecha" size={18} /></Link>
        </div>
        <ul className={styles.permisos} role="list" data-reveal>
          <li><Icono nombre="escudo" size={18} /><div><h3>Acceso con permisos</h3><p>El acceso a tu información requiere una sesión y los permisos correspondientes.</p></div></li>
          <li><Icono nombre="camara" size={18} /><div><h3>Consentimiento independiente</h3><p>Guardar fotografías de prueba requiere un consentimiento separado de cualquier futuro procesamiento con IA.</p></div></li>
        </ul>
      </div>
    </section>

    <PlanesDentaIA />

    <section className={`${styles.cierre} public-inverse`} aria-labelledby="comenzar-titulo">
      <div className={`${styles.cierreInner} public-wrap`} data-reveal>
        <div>
          <h2 className="public-title" id="comenzar-titulo">Prepara tu próxima consulta</h2>
          <p>Abre tu cuenta gratis y accede a tu espacio personal.</p>
        </div>
        <div className="actions">
          <Link href="/cuenta?modo=registro" className="action">Crear cuenta <Icono nombre="flecha" size={18} /></Link>
          <Link href="/cuenta" className="action action-secondary">Iniciar sesión</Link>
        </div>
      </div>
    </section>
  </>;
}
