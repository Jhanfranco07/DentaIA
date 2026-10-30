import { Icono } from "@/components/Identidad";
import styles from "./administracion.module.css";

export default function EncabezadoAdministrativo({ seccion }: { seccion: string }) {
  return <header className={styles.encabezado}>
    <p>Administración <span aria-hidden="true">/</span> <strong>{seccion}</strong></p>
    <span className={styles.indicador}><Icono nombre="escudo" size={16} /> Vista de diseño</span>
  </header>;
}
