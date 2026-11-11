import { Icono, type NombreIcono } from "@/components/Identidad";
import styles from "./tarjeta-metrica.module.css";

export default function TarjetaMetrica({ titulo, valor, contexto, icono }: {
  titulo: string;
  valor: number | string;
  contexto: string;
  icono: NombreIcono;
}) {
  return <div className={styles.tarjeta}>
    <span className={styles.icono}><Icono nombre={icono} size={20} /></span>
    <span className={styles.titulo}>{titulo}</span>
    <strong className={styles.valor}>{valor}</strong>
    <span className={styles.contexto}>{contexto}</span>
  </div>;
}
