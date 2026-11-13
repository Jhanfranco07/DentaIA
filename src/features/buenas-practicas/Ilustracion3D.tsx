import styles from "./buenas-practicas.module.css";

const TIPOS = ["cepillado","hilo","alimentacion","fluor","encias","controles","heroe"] as const;
export type TipoIlustracion = (typeof TIPOS)[number];

/** Ilustraciones originales generadas para DentaIA y optimizadas en una sola hoja AVIF. */
export default function Ilustracion3D({ tipo }: { tipo: string }) {
  const seguro: TipoIlustracion = TIPOS.includes(tipo as TipoIlustracion) ? tipo as TipoIlustracion : "heroe";
  return <span aria-hidden="true" className={styles.imagen3d} data-tipo={seguro} />;
}
