import Link from "next/link";
import { Icono, type NombreIcono } from "@/components/Identidad";
import styles from "./tarjeta-accion.module.css";

export default function TarjetaAccion({ href, titulo, descripcion, accion, icono }: {
  href: string;
  titulo: string;
  descripcion: string;
  accion: string;
  icono: NombreIcono;
}) {
  return <article className={styles.tarjeta}>
    <span className={styles.icono}><Icono nombre={icono} size={21} /></span>
    <div className={styles.copia}><h3>{titulo}</h3><p>{descripcion}</p></div>
    <Link href={href} className={styles.enlace}>{accion}<Icono nombre="flecha" size={16} /></Link>
  </article>;
}
