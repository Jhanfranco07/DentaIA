"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icono, Marca } from "./Identidad";

const enlaces = [["/", "Inicio"], ["/#como-funciona", "Cómo funciona"], ["/analisis", "Análisis dental con IA"], ["/directorio", "Odontólogos"], ["/privacidad", "Privacidad"]] as const;
export default function Encabezado() {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { setAbierto(false); }, [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const close = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setAbierto(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setAbierto(false); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [abierto]);
  return <header className="site-header" ref={header}><div className="site-header-inner">
    <Link href="/" aria-label="DentaIA, inicio" className="marca-enlace"><Marca /></Link>
    <span className="header-divider" aria-hidden="true" />
    <button ref={toggle} type="button" className={`menu-toggle ${abierto ? "is-open" : ""}`} aria-label={abierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={abierto} aria-controls="navegacion-principal" onClick={() => setAbierto(!abierto)}><span className="menu-bars" aria-hidden="true"><i /><i /><i /></span><span>Menú</span></button>
    <nav id="navegacion-principal" aria-label="Navegación principal" className={`site-nav ${abierto ? "is-open" : ""}`}>
      {enlaces.map(([href, texto]) => {
        const activo = href === "/" ? ruta === "/" : href.includes("#") ? false : ruta === href || ruta.startsWith(`${href}/`);
        return <Link key={href} href={href} onClick={() => setAbierto(false)} aria-current={activo ? "page" : undefined}>{texto}</Link>;
      })}
    </nav><Link href="/cuenta" className="action action-small action-account" aria-label="Iniciar sesión o crear una cuenta" aria-current={ruta === "/cuenta" ? "page" : undefined}><Icono nombre="persona" size={17} /> Iniciar sesión</Link>
  </div></header>;
}
