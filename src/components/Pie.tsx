import Link from "next/link";
import { Marca } from "./Identidad";
export default function Pie() {
  return <footer className="site-footer"><div className="site-footer-inner">
    <div><Link href="/" aria-label="DentaIA, inicio"><Marca /></Link><p>Más información para cuidar tu sonrisa.<br />Orientación educativa, a tu ritmo.</p></div>
    <nav aria-label="Explorar"><strong>Tu recorrido</strong><Link href="/analisis/demo">Explorar demostración</Link><Link href="/directorio">Encontrar odontólogo</Link><Link href="/solicitudes">Mis solicitudes</Link></nav>
    <nav aria-label="Información"><strong>Acerca de DentaIA</strong><Link href="/#como-funciona">Cómo funciona</Link><Link href="/privacidad">Privacidad y consentimiento</Link><Link href="/cuenta">Mi cuenta</Link></nav>
  </div><div className="footer-note">Demostración académica con resultados simulados. No ofrece diagnósticos ni reemplaza una evaluación odontológica.</div></footer>;
}
