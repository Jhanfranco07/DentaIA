"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Marca } from "./Identidad";
const enlaces = [["/analisis/demo", "Demostración"], ["/directorio", "Odontólogos"], ["/fotografias", "Mis fotografías"], ["/solicitudes", "Mis solicitudes"]] as const;
export default function Encabezado() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { setAbierto(false); }, [ruta]);
  return <header className="site-header"><div className="site-header-inner">
    <Link href="/" aria-label="DentaIA, inicio" className="marca-enlace"><Marca /></Link>
    <button type="button" className="menu-toggle" aria-label={abierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={abierto} aria-controls="navegacion-principal" onClick={() => setAbierto(!abierto)}>Menú <span aria-hidden="true">{abierto ? "−" : "+"}</span></button>
    <nav id="navegacion-principal" aria-label="Navegación principal" className={`site-nav ${abierto ? "is-open" : ""}`} onKeyDown={e => { if (e.key === "Escape") { setAbierto(false); document.querySelector<HTMLButtonElement>(".menu-toggle")?.focus(); } }}>
      {enlaces.map(([href, texto]) => <Link key={href} href={href} aria-current={ruta.startsWith(href) ? "page" : undefined}>{texto}</Link>)}
    </nav><Link href="/cuenta" className="action action-small action-secondary" aria-current={ruta === "/cuenta" ? "page" : undefined}>Mi cuenta</Link>
  </div></header>;
}
