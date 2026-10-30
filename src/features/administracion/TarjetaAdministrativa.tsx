import { Icono } from "@/components/Identidad";
import styles from "./administracion.module.css";

type Props = {
  titulo: string;
  descripcion: string;
  icono: "persona" | "escudo";
  accion: string;
  onAbrir: () => void;
};

export default function TarjetaAdministrativa({ titulo, descripcion, icono, accion, onAbrir }: Props) {
  return <article className={styles.tarjeta}>
    <span className={styles.iconoTarjeta}><Icono nombre={icono} size={23} /></span>
    <h2>{titulo}</h2>
    <p>{descripcion}</p>
    <button type="button" className={styles.enlaceBoton} onClick={onAbrir}>
      {accion}<Icono nombre="flecha" size={17} />
    </button>
  </article>;
}
