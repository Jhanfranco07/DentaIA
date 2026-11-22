import Image from "next/image";
import Link from "next/link";
import styles from "./privacidad.module.css";

const contenidos = [
  ["perfiles", "Perfiles y datos de ejemplo"],
  ["preparar-fotografia", "Preparar una fotografía para análisis"],
  ["fotografias-guardadas", "Tus fotografías guardadas"],
  ["cuenta-solicitudes", "Tu cuenta y tus solicitudes"],
  ["resultados-ia", "Resultados de inteligencia artificial"]
] as const;

export default function Privacidad() {
  return (
    <div className={`${styles.pagina} public-wrap`}>
      <header className={`public-intro ${styles.hero}`}>
        <div>
          <p className="eyebrow">Privacidad y consentimiento</p>
          <h1>Tú decides qué compartir</h1>
          <p>Una explicación clara de cómo se utiliza tu información en DentaIA.</p>
        </div>
        <Image src="/landing/privacidad.webp" alt="" width={1300} height={867} sizes="(max-width: 680px) 90vw, 45vw" />
      </header>
      <div className={styles.lectura}>
        <nav className={styles.indice} aria-label="Contenido de privacidad">
          <strong>En esta página</strong>
          <ul>
            {contenidos.map(([id, titulo]) => <li key={id}><a href={`#${id}`}>{titulo}</a></li>)}
          </ul>
        </nav>
        <article className={styles.contenido}>
        <section aria-labelledby="perfiles">
          <h2 id="perfiles">Perfiles y datos de ejemplo</h2>
          <p>El directorio distingue los perfiles y establecimientos ficticios de la información publicada por los canales autorizados. Un perfil de ejemplo no representa atención disponible, una clínica real ni una recomendación profesional. Una solicitud de demostración no confirma una cita.</p>
        </section>
        <section aria-labelledby="preparar-fotografia">
          <h2 id="preparar-fotografia">Preparar una fotografía para análisis</h2>
          <p>En el módulo privado de análisis, la cámara se solicita solo después de que la actives. Una fotografía tomada o seleccionada se revisa localmente y no se almacena ni se envía; el motor de IA todavía no está integrado. Confirmar la imagen no autoriza guardarla ni procesarla. El permiso de almacenamiento de “Mis fotografías” y cualquier futuro consentimiento de procesamiento por IA son independientes.</p>
        </section>
        <section aria-labelledby="fotografias-guardadas">
          <h2 id="fotografias-guardadas">Tus fotografías guardadas</h2>
          <p>En «Mis fotografías» puedes guardar imágenes de prueba después de iniciar sesión y aceptar el consentimiento de almacenamiento. Se guardan en un espacio privado asociado a tu cuenta. Puedes consultarlas, eliminarlas o revocar el permiso para nuevas cargas. Revocar el consentimiento no elimina las fotografías anteriores: puedes borrarlas desde tu galería.</p>
          <p>El permiso de almacenamiento no autoriza procesamiento por IA, entrenamiento de modelos ni diagnóstico. Usa únicamente imágenes sintéticas de prueba durante esta demostración.</p>
        </section>
        <section aria-labelledby="cuenta-solicitudes">
          <h2 id="cuenta-solicitudes">Tu cuenta y tus solicitudes</h2>
          <p>El correo, el perfil y las solicitudes se guardan para permitir el acceso a tu espacio personal. Las solicitudes y la información clínica se consultan según los permisos vigentes de cada cuenta. Los perfiles ficticios se identifican como tales; una solicitud de demostración no confirma una cita ni acredita una atención real.</p>
        </section>
        <section aria-labelledby="resultados-ia">
          <h2 id="resultados-ia">Resultados de inteligencia artificial</h2>
          <p>El motor de análisis todavía no está integrado. Preparar una fotografía no produce un diagnóstico ni un resultado automático. Los datos educativos o de prueba no se presentan como análisis de tu imagen. Cualquier procesamiento futuro requerirá información y consentimiento específicos.</p>
        </section>
          <div className="notice"><strong>Orientación responsable</strong><p>El motor de análisis con IA aún no está conectado. DentaIA no ofrece un diagnóstico ni sustituye la evaluación de un profesional. Ante una molestia o preocupación, consulta con tu odontólogo.</p></div>
          <div className="actions">
            <Link className="action" href="/analisis">Conocer el análisis dental</Link>
            <Link className="action action-secondary" href="/directorio">Encontrar odontólogos</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
