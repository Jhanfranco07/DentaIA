import type { ReactNode } from "react";
import styles from "./panel.module.css";

type Props = {
  tipo: "cargando" | "vacio" | "error";
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
};

export default function EstadoPanel({ tipo, titulo, children, accion }: Props) {
  const clase = tipo === "error" ? `${styles.aviso} ${styles.avisoError}` : styles.aviso;
  return (
    <div className={clase} role={tipo === "error" ? "alert" : "status"}>
      <strong>{titulo}</strong>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}