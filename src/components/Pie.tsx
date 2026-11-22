import Link from "next/link";
import { Marca } from "./Identidad";

export default function Pie() {
  return <footer className="site-footer">
    <div className="site-footer-inner">
      <div className="footer-brand">
        <Link href="/" aria-label="DentaIA, inicio"><Marca /></Link>
        <p>Organiza tu cuidado dental y prepara tu próxima consulta.</p>
      </div>
      <nav aria-label="Explorar DentaIA">
        <strong>Explorar</strong>
        <Link href="/#como-funciona">Cómo funciona</Link>
        <Link href="/#funcionalidades">Funcionalidades</Link>
        <Link href="/directorio">Directorio odontológico</Link>
        <Link href="/#planes">Planes</Link>
        <Link href="/analisis">Preparación de fotografías</Link>
        <Link href="/profesional">Acceso para odontólogos</Link>
      </nav>
      <nav aria-label="Cuenta y privacidad">
        <strong>Cuenta y privacidad</strong>
        <Link href="/privacidad">Privacidad y consentimiento</Link>
        <Link href="/cuenta">Iniciar sesión</Link>
        <Link href="/cuenta?modo=registro">Crear una cuenta</Link>
      </nav>
    </div>
    <div className="footer-note">
      <p>El análisis con IA está en desarrollo. DentaIA no ofrece diagnósticos ni reemplaza una evaluación odontológica.</p>
    </div>
  </footer>;
}
