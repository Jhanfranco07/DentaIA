import { Icono } from "@/components/Identidad";
import styles from "./administracion.module.css";

export type EstadoAdministrativoTipo = "carga" | "vacio" | "error";

type Props = { estado: EstadoAdministrativoTipo; onReintentar?: () => void };

// Estados de presentación: no realizan consultas ni representan respuestas del servidor.
export default function EstadoAdministrativo({ estado, onReintentar }: Props) {
  return <div className={styles.estado} data-estado={estado}>
    <span className={styles.iconoEstado} aria-hidden="true">
      {estado === "carga" ? <span className={styles.cargando} />
        : estado === "error" ? "!" : <Icono nombre="persona" size={28} />}
    </span>
    <div role={estado === "error" ? "alert" : "status"} aria-atomic="true">
      <strong>{estado === "carga" ? "Cargando cuentas…"
        : estado === "vacio" ? "No hay cuentas para mostrar" : "No se pudieron cargar las cuentas"}</strong>
      <p>{estado === "carga" ? "Espera mientras se prepara la lista."
        : estado === "vacio" ? "Las cuentas disponibles aparecerán en este espacio."
          : "Inténtalo de nuevo. Si el problema continúa, vuelve más tarde."}</p>
    </div>
    {estado === "carga" && <div className={styles.esqueleto} aria-hidden="true"><span /><span /><span /></div>}
    {estado === "error" && onReintentar && <button type="button" className={styles.accionEstado}
      onClick={onReintentar}>Reintentar simulación</button>}
  </div>;
}
