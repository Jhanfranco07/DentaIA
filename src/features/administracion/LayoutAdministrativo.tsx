"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icono } from "@/components/Identidad";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import NavegacionAdministrativa from "./NavegacionAdministrativa";
import EncabezadoAdministrativo from "./EncabezadoAdministrativo";
import { SECCIONES_ADMINISTRATIVAS, type NavegacionAdministrativaProps } from "./estructura";
import styles from "./administracion.module.css";
import { useSesion } from "@/features/cuenta/useSesion";
import { rolesDelUsuario } from "@/features/autorizacion/roles";

type Props = NavegacionAdministrativaProps & { children: ReactNode };

export default function LayoutAdministrativo({ children, seccion, onSeleccionar }: Props) {
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);
  const actual = SECCIONES_ADMINISTRATIVAS.find(item => item.id === seccion)!;
  const { usuario } = useSesion();
  const nombre = usuario?.user_metadata?.full_name;
  const nombreUsuario = typeof nombre === "string" && nombre.trim() ? nombre.trim() : usuario?.email?.split("@")[0] ?? "Cuenta";
  const roles = rolesDelUsuario(usuario);
  const rolUsuario = roles.includes("superusuario") ? "Superadministrador" : "Cuenta administrativa";
  const [errorSalida, setErrorSalida] = useState("");
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    if (saliendo) return;
    setSaliendo(true); setErrorSalida("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/cuenta"); router.refresh();
    } catch {
      setErrorSalida("No se pudo cerrar la sesión en este navegador. Vuelve a intentarlo.");
      setSaliendo(false);
    }
  }

  useEffect(() => {
    const movil = window.matchMedia("(max-width: 800px)");
    function adaptar() {
      // Evitar dejar el foco en controles que se ocultan al cambiar de tamaño.
      if (movil.matches && lateral.current?.contains(document.activeElement)) botonMenu.current?.focus();
      if (!movil.matches && document.activeElement === botonMenu.current) {
        lateral.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
      }
      setMenuAbierto(false);
    }
    movil.addEventListener("change", adaptar);
    return () => movil.removeEventListener("change", adaptar);
  }, []);

  return <div className={styles.panel} onKeyDown={event => {
    if (event.key === "Escape" && menuAbierto) {
      event.preventDefault();
      setMenuAbierto(false);
      botonMenu.current?.focus();
    }
  }}>
    <button ref={botonMenu} type="button" className={styles.botonMenu}
      aria-expanded={menuAbierto} aria-controls="admin-menu"
      onClick={() => setMenuAbierto(abierto => !abierto)}>
      <Icono nombre="escudo" size={20} />
      <span>{menuAbierto ? "Cerrar menú administrativo" : "Abrir menú administrativo"}</span>
      <span aria-hidden="true">{menuAbierto ? "−" : "+"}</span>
    </button>
    <aside ref={lateral} id="admin-menu" className={styles.lateral} data-abierto={menuAbierto}
      aria-label="Espacio administrativo de demostración">
      <div className={styles.identidad}>
        <span className={styles.simbolo}><Icono nombre="escudo" size={25} /></span>
        <div><strong>DentaIA</strong><span>Administración</span></div>
      </div>
      <p className={styles.etiquetaMenu}>ESPACIO DE TRABAJO</p>
      <NavegacionAdministrativa seccion={seccion} onSeleccionar={destino => {
        setMenuAbierto(false);
        onSeleccionar(destino);
      }} />
      <div className={styles.notaLateral}>
        <strong>Acceso administrativo protegido</strong>
        <p>Las lecturas dependen de habilitación del entorno. Los cambios de roles permanecen desactivados en Vercel.</p>
      </div>
      <Link href="/cuenta" className={styles.volver}>Mi cuenta</Link>
      <button type="button" className={styles.volver} onClick={() => { void cerrarSesion(); }} disabled={saliendo}>
        {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {errorSalida && <p role="alert" className={styles.errorAdmin}>{errorSalida}</p>}
      <Link href="/" className={styles.volver}>Volver a DentaIA <span aria-hidden="true">↗</span></Link>
    </aside>
    <div className={styles.trabajo}>
      <a href="#admin-titulo" className={styles.saltarContenido}>Saltar al contenido del panel</a>
      <EncabezadoAdministrativo seccion={actual.titulo} nombre={nombreUsuario} rol={rolUsuario} />
      <div className={styles.contenido}>{children}</div>
    </div>
  </div>;
}
