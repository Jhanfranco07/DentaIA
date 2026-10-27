
import FormularioSolicitud from "@/features/solicitudes/FormularioSolicitud";
import MisSolicitudes from "@/features/solicitudes/MisSolicitudes";
import styles from "@/features/solicitudes/solicitudes.module.css";

export default function RequestsPage() {
  return (
    <main className={styles.contenedor}>
      <header className={styles.encabezado}>
        <p className={styles.etiquetaSuperior}>
          SOLICITUDES ODONTOLÓGICAS
        </p>

        <h1 className={styles.titulo}>
          Gestiona tus solicitudes de orientación
        </h1>

        <p className={styles.descripcion}>
          Selecciona un profesional, registra una solicitud
          de demostración y consulta su estado.
          Los perfiles son ficticios y no se confirman
          citas clínicas reales.
        </p>
      </header>

      <FormularioSolicitud />
      <MisSolicitudes />
    </main>
  );
}
