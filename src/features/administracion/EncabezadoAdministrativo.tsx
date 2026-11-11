import { Icono } from "@/components/Identidad";
import styles from "./administracion.module.css";

export default function EncabezadoAdministrativo({ seccion, nombre, rol }: { seccion: string; nombre: string; rol: string }) {
  return <header className={styles.encabezado}>
    <div className={styles.trazoEncabezado}><p>Administración <span aria-hidden="true">/</span> <strong>{seccion}</strong></p><span className={styles.indicador}><Icono nombre="escudo" size={16} /> Servicios protegidos</span></div>
    <div className={styles.identidadEncabezado}><span className={styles.avatarAdmin} aria-hidden="true">{nombre.slice(0, 1).toLocaleUpperCase("es")}</span><span><strong>{nombre}</strong><small>{rol}</small></span></div>
  </header>;
}
