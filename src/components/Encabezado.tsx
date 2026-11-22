"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSesion } from "@/features/cuenta/useSesion";
import { rolesDelUsuario, rutaPrincipalPorRoles } from "@/features/autorizacion/roles";
import { Icono, Marca } from "./Identidad";

const enlaces = [
  ["/", "Inicio"],
  ["/#como-funciona", "Cómo funciona"],
  ["/#funcionalidades", "Funcionalidades"],
  ["/directorio", "Odontólogos"],
  ["/privacidad", "Privacidad"],
] as const;

export default function Encabezado() {
  const ruta = usePathname();
  const { usuario } = useSesion();
  const destino = usuario ? rutaPrincipalPorRoles(rolesDelUsuario(usuario)) ?? "/cuenta" : "/cuenta";
  const [abierto, setAbierto] = useState(false);
  const [ancla, setAncla] = useState("");
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sincronizar = () => setAncla(window.location.hash);
    sincronizar();
    setAbierto(false);
    window.addEventListener("hashchange", sincronizar);
    window.addEventListener("popstate", sincronizar);
    return () => {
      window.removeEventListener("hashchange", sincronizar);
      window.removeEventListener("popstate", sincronizar);
    };
  }, [ruta]);

  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAbierto(false);
      toggle.current?.focus();
    };
    document.addEventListener("pointerdown", cerrarFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  const anclaActiva = enlaces.some(([href]) => href === "/" + ancla && ancla !== "");

  return <header className="site-header" ref={header}>
    <div className="site-header-inner">
      <Link href="/" aria-label="DentaIA, inicio" className="marca-enlace" onNavigate={() => { setAncla(""); setAbierto(false); }}><Marca /></Link>
      <button ref={toggle} type="button" className="menu-toggle" aria-label={abierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={abierto} aria-controls="navegacion-principal" onClick={() => setAbierto(valor => !valor)}>
        <Icono nombre={abierto ? "cerrar" : "menu"} size={20} />
        <span>Menú</span>
      </button>
      <nav id="navegacion-principal" aria-label="Navegación principal" className={`site-nav ${abierto ? "is-open" : ""}`}>
        {enlaces.map(([href, texto]) => {
          const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
          const activo = hash ? ruta === "/" && hash === ancla : href === "/" ? ruta === "/" && !anclaActiva : ruta === href || ruta.startsWith(`${href}/`);
          return <Link key={href} href={href} onNavigate={() => { setAbierto(false); setAncla(hash); }} aria-current={activo ? (hash ? "location" : "page") : undefined}>{texto}</Link>;
        })}
      </nav>
      <Link href={destino} className="site-account" aria-current={ruta === "/cuenta" ? "page" : undefined} onNavigate={() => setAbierto(false)}>
        {usuario ? "Mi espacio" : "Iniciar sesión"} <Icono nombre="flecha" size={16} />
      </Link>
    </div>
  </header>;
}
