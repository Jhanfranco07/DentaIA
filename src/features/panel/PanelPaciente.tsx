import Link from "next/link";
import styles from "./panel.module.css";

const SECCIONES = [
  {
    id: "cuenta",
    href: "/cuenta",
    titulo: "Mi cuenta",
    descripcion: "Consulta tu correo y el nombre de tu perfil, y actualízalo cuando lo necesites.",
    accion: "Ir a mi cuenta",
  },
  {
    id: "fotografias",
    href: "/fotografias",
    titulo: "Mis fotografías",
    descripcion: "Gestiona tu permiso de almacenamiento y tus imágenes de prueba privadas.",
    accion: "Ir a mis fotografías",
  },
  {
    id: "solicitudes",
    href: "/solicitudes",
    titulo: "Mis solicitudes",
    descripcion: "Revisa tus solicitudes de demostración y cancela las que sigan pendientes.",
    accion: "Ir a mis solicitudes",
  },
] as const;

export default function PanelPaciente() {
  return (
    <section className={styles.pagina}>
      <header className={styles.cabecera}>
        <span className={styles.etiqueta}>Panel del paciente</span>
        <h1>Tu espacio personal</h1>
        <p>
          Desde aquí accedes a tu cuenta, tus fotografías y tus solicitudes. Este prototipo usa
          datos <strong>ficticios</strong> y no realiza diagnósticos ni análisis clínicos.
        </p>
      </header>

      <nav aria-label="Secciones del panel del paciente">
        <ul className={styles.grilla}>
          {SECCIONES.map((s) => (
            <li key={s.id} className={styles.tarjeta}>
              <h2>{s.titulo}</h2>
              <p>{s.descripcion}</p>
              <Link
                href={s.href}
                className={styles.enlace}
                aria-label={`${s.accion}: ${s.titulo}`}
              >
                {s.accion} →
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}