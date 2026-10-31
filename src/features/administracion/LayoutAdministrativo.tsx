"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import NavegacionAdministrativa from "./NavegacionAdministrativa";
import EncabezadoAdministrativo from "./EncabezadoAdministrativo";
import { SECCIONES_ADMINISTRATIVAS, type NavegacionAdministrativaProps } from "./estructura";
import styles from "./administracion.module.css";

type Props = NavegacionAdministrativaProps & { children: ReactNode };

export default function LayoutAdministrativo({ children, seccion, onSeleccionar }: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);
  const actual = SECCIONES_ADMINISTRATIVAS.find(item => item.id === seccion)!;

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
        <strong>Diseño, sin datos reales</strong>
        <p>Esta vista no representa una sesión de superusuario ni permite administrar cuentas.</p>
      </div>
      <Link href="/" className={styles.volver}>Volver a DentaIA <span aria-hidden="true">↗</span></Link>
    </aside>
    <div className={styles.trabajo}>
      <a href="#admin-titulo" className={styles.saltarContenido}>Saltar al contenido del panel</a>
      <EncabezadoAdministrativo seccion={actual.titulo} />
      <div className={styles.contenido}>{children}</div>
    </div>
  </div>;
}
