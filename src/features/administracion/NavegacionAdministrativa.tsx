import { Icono } from "@/components/Identidad";
import { SECCIONES_ADMINISTRATIVAS, type NavegacionAdministrativaProps } from "./estructura";
import styles from "./administracion.module.css";

export default function NavegacionAdministrativa({ seccion, onSeleccionar }: NavegacionAdministrativaProps) {
  return <nav aria-label="Secciones del diseño administrativo" className={styles.navegacion}>
    {SECCIONES_ADMINISTRATIVAS.map(item => <button
      key={item.id}
      type="button"
      aria-pressed={seccion === item.id}
      onClick={() => onSeleccionar(item.id)}
    >
      <Icono nombre={item.icono} size={20} />
      <span>{item.titulo}</span>
    </button>)}
  </nav>;
}
