import Link from "next/link";
import { Icono, Marca } from "./Identidad";
export default function Pie() {
  return <footer className="site-footer"><div className="site-footer-inner">
    <div className="footer-brand"><Link href="/" aria-label="DentaIA, inicio"><Marca /></Link><p>Más claridad para tu cuidado dental.<br />Más tranquilidad para tu próximo paso.</p><span className="footer-educational"><Icono nombre="escudo" size={16} /> Privacidad y acceso protegido</span></div>
    <nav aria-label="Explorar"><strong>Conoce DentaIA</strong><Link href="/#como-funciona">Cómo funciona</Link><Link href="/analisis">Preparación de fotografías</Link><Link href="/directorio">Directorio odontológico</Link></nav>
    <nav aria-label="Información"><strong>Acceso y privacidad</strong><Link href="/privacidad">Privacidad y consentimiento</Link><Link href="/cuenta">Iniciar sesión</Link><Link href="/cuenta?modo=registro">Crear una cuenta</Link></nav>
  </div><div className="footer-note"><span>DentaIA · Tu cuidado, a tu ritmo.</span><p>El análisis con IA está en desarrollo. Los perfiles de ejemplo se identifican en el directorio. No ofrece diagnósticos ni reemplaza una evaluación odontológica.</p></div></footer>;
}
