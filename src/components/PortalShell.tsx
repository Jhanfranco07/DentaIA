"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Icono, Marca } from "./Identidad";
import styles from "./portal-shell.module.css";

export type EnlacePortal = { href: string; etiqueta: string; exacto?: boolean };

export default function PortalShell({ area, descripcion, enlaces, children }: {
  area: string;
  descripcion: string;
  enlaces: readonly EnlacePortal[];
  children: ReactNode;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState("");
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAbierto(false); boton.current?.focus(); }
    };
    document.addEventListener("keydown", cerrarConEscape);
    return () => document.removeEventListener("keydown", cerrarConEscape);
  }, [abierto]);

  async function cerrarSesion() {
    if (saliendo) return;
    setSaliendo(true); setError("");
    try {
      const { error: errorAuth } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
      if (errorAuth) throw errorAuth;
      router.replace("/cuenta");
      router.refresh();
    } catch {
      setError("No se pudo cerrar la sesión en este navegador. Vuelve a intentarlo.");
      setSaliendo(false);
    }
  }

  return <>
    <header className={styles.encabezado}>
      <Link href="/" className={styles.marca} aria-label="DentaIA, inicio"><Marca /></Link>
      <div className={styles.identidad}><span className={styles.etiqueta}>PORTAL {area.toLocaleUpperCase("es")}</span><span>{descripcion}</span></div>
      <button ref={boton} type="button" className={styles.botonMenu} aria-expanded={abierto} aria-controls="navegacion-portal" aria-label={abierto ? "Cerrar navegación del portal" : "Abrir navegación del portal"} onClick={() => setAbierto(valor => !valor)}>
        <span aria-hidden="true">{abierto ? "×" : "☰"}</span><span className={styles.soloMovil}>{abierto ? "Cerrar menú" : "Menú"}</span>
      </button>
      <Link href="/cuenta" className={styles.cuenta}><Icono nombre="persona" size={17} /> Mi cuenta</Link>
      <button type="button" className={styles.salir} onClick={() => { void cerrarSesion(); }} disabled={saliendo}>
        {saliendo ? "Cerrando…" : "Cerrar sesión"}
      </button>
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.marco}>
      <aside id="navegacion-portal" className={styles.lateral} data-abierto={abierto} aria-label={`Navegación del portal ${area}`}>
        <p className={styles.tituloNavegacion}>Tu espacio</p>
        <nav aria-label={`Secciones de ${area}`}>
          {enlaces.map(({ href, etiqueta, exacto }) => {
            const activo = exacto ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);
            return <Link key={href} href={href} aria-current={activo ? "page" : undefined} className={styles.enlace}>{etiqueta}</Link>;
          })}
        </nav>
        <Link href="/" className={styles.volver}>Ir a la página pública</Link>
      </aside>
      <main id="contenido" tabIndex={-1} className={styles.contenido}>{children}</main>
    </div>
  </>;
}
