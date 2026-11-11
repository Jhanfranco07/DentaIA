import Image from "next/image";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import styles from "./home.module.css";

export default function Home() {
  return <>
    <section className={styles.hero} aria-labelledby="inicio-titulo">
      <div className={styles.heroCopy}>
        <h1 id="inicio-titulo">Orientación y cuidado para tu salud bucal.</h1>
        <p>DentaIA reúne tu espacio personal, un directorio odontológico y herramientas para preparar tu próxima consulta. Cada función respeta los permisos de tu cuenta y tu privacidad.</p>
        <div className="actions"><Link href="/cuenta?modo=registro" className="action">Crear mi cuenta <Icono nombre="flecha" size={18} /></Link><Link href="/directorio" className="action action-secondary">Explorar odontólogos</Link></div>
        <Link className={styles.enlaceProfesional} href="/profesional">¿Eres odontólogo? Accede a tu espacio profesional <Icono nombre="flecha" size={16} /></Link>
      </div>
      <figure className={styles.fotografia}>
        <Image src="/hero/hero-1.jpg" alt="Una mujer sonríe en la recepción de un consultorio dental" width={1376} height={768} priority sizes="(max-width: 760px) 100vw, 50vw" />
        <figcaption>Encuentra tu próximo paso para cuidar tu salud bucal.</figcaption>
      </figure>
    </section>

    <section className={styles.seccion} id="funcionalidades" aria-labelledby="funciones-titulo">
      <div className={styles.intro}><span className="eyebrow">UN ESPACIO PARA CADA NECESIDAD</span><h2 id="funciones-titulo">Menos búsquedas.<br />Más continuidad en tu cuidado.</h2><p>Desde preparar tu próxima consulta hasta revisar información autorizada: cada función tiene su lugar y cada cuenta, sus permisos.</p></div>
      <div className={styles.beneficios}>
        <article><Icono nombre="persona" size={26} /><h3>Tu espacio personal</h3><p>Consulta tu perfil, organiza tus fotografías de prueba y revisa tus solicitudes desde el panel del paciente.</p><Link className="text-link" href="/panel">Ir a mi panel <span aria-hidden="true">→</span></Link></article>
        <article><Icono nombre="diente" size={26} /><h3>Opciones de atención</h3><p>Busca por especialidad o distrito y consulta las ubicaciones publicadas. Los perfiles y establecimientos de ejemplo están identificados.</p><Link className="text-link" href="/directorio">Consultar el directorio <span aria-hidden="true">→</span></Link></article>
        <article><Icono nombre="clinica" size={26} /><h3>Un entorno profesional</h3><p>Los odontólogos autorizados pueden consultar sus clínicas, solicitudes e historial según su membresía y los permisos vigentes.</p><Link className="text-link" href="/profesional">Acceder como profesional <span aria-hidden="true">→</span></Link></article>
      </div>
    </section>

    <section className={`${styles.seccion} ${styles.como}`} id="como-funciona" aria-labelledby="como-titulo">
      <div className={styles.intro}><span className="eyebrow">COMIENZA A TU RITMO</span><h2 id="como-titulo">Un recorrido sencillo.</h2><p>No necesitas conocer la plataforma para encontrar tu próximo paso.</p></div>
      <ol className={styles.pasos}>
        <li><span aria-hidden="true">01</span><h3>Crea tu cuenta</h3><p>Registra tus datos y confirma tu correo para entrar a tu espacio personal.</p><Link href="/cuenta?modo=registro" className="text-link">Crear una cuenta →</Link></li>
        <li><span aria-hidden="true">02</span><h3>Organiza lo importante</h3><p>Completa tu perfil y consulta las herramientas disponibles desde la navegación de tu panel.</p></li>
        <li><span aria-hidden="true">03</span><h3>Prepara tu siguiente consulta</h3><p>Explora el directorio y revisa el alcance de cada solicitud. Enviar una solicitud no confirma una cita.</p></li>
      </ol>
    </section>

    <section className={`${styles.seccion} ${styles.confianza}`} aria-label="Privacidad y alcance del producto">
      <div><Icono nombre="escudo" size={28} /><h2>Tus datos merecen cuidado.</h2><p>Tu información personal requiere sesión y permisos. Guardar fotografías exige un consentimiento independiente y no autoriza utilizarlas para entrenamiento o análisis con IA.</p><Link href="/privacidad" className="text-link">Conocer privacidad y consentimiento →</Link></div>
      <div className={styles.ia}><span className="eyebrow">INTELIGENCIA ARTIFICIAL EN DESARROLLO</span><h3>Hoy puedes preparar una fotografía.</h3><p>La captura y revisión local están disponibles para pacientes. El motor de análisis aún no está conectado: no genera resultados ni diagnósticos. Las muestras educativas se mantienen separadas de tus fotografías.</p><Link href="/analisis" className="text-link">Conocer la preparación de imágenes →</Link></div>
    </section>

    <section className={styles.cierre} aria-labelledby="comenzar-titulo"><div><span className="eyebrow">TU SIGUIENTE PASO</span><h2 id="comenzar-titulo">Todo comienza con tu espacio.</h2><p>Accede a tu cuenta y continúa donde lo dejaste.</p></div><Link href="/cuenta" className="action">Entrar a DentaIA <Icono nombre="flecha" size={18} /></Link></section>
  </>;
}
