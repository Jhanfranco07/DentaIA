import type { ReactNode } from "react";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import NavegacionAdministrativa from "./NavegacionAdministrativa";
import EncabezadoAdministrativo from "./EncabezadoAdministrativo";
import { SECCIONES_ADMINISTRATIVAS, type NavegacionAdministrativaProps } from "./estructura";
import styles from "./administracion.module.css";

type Props = NavegacionAdministrativaProps & { children: ReactNode };

export default function LayoutAdministrativo({ children, seccion, onSeleccionar }: Props) {
  const actual = SECCIONES_ADMINISTRATIVAS.find(item => item.id === seccion)!;

  return <div className={styles.panel}>
    <aside className={styles.lateral} aria-label="Espacio administrativo de demostración">
      <div className={styles.identidad}>
        <span className={styles.simbolo}><Icono nombre="escudo" size={25} /></span>
        <div><strong>DentaIA</strong><span>Administración</span></div>
      </div>
      <p className={styles.etiquetaMenu}>ESPACIO DE TRABAJO</p>
      <NavegacionAdministrativa seccion={seccion} onSeleccionar={onSeleccionar} />
      <div className={styles.notaLateral}>
        <strong>Diseño, sin datos reales</strong>
        <p>Esta vista no representa una sesión de superusuario ni permite administrar cuentas.</p>
      </div>
      <Link href="/" className={styles.volver}>Volver a DentaIA <span aria-hidden="true">↗</span></Link>
    </aside>
    <div className={styles.trabajo}>
      <EncabezadoAdministrativo seccion={actual.titulo} />
      <div className={styles.contenido}>{children}</div>
    </div>
  </div>;
}
