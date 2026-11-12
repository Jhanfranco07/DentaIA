
import FormularioSolicitud from "@/features/solicitudes/FormularioSolicitud";
import MisSolicitudes from "@/features/solicitudes/MisSolicitudes";
import styles from "@/features/solicitudes/solicitudes.module.css";
import AccesoRol from "@/features/autorizacion/AccesoRol";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ odontologo?: string }> }) {
  const { odontologo } = await searchParams;
  return <AccesoRol rolesRequeridos={["paciente"]} modulo="las solicitudes del paciente">
    <section className={styles.contenedor}>
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

      <div className={styles.accionesPagina}><a href="#nueva-solicitud" className={styles.enlaceNuevaSolicitud}>+ Nueva solicitud</a></div>
      <MisSolicitudes />
      <div id="nueva-solicitud"><FormularioSolicitud odontologoInicial={odontologo ?? ""} /></div>
    </section>
  </AccesoRol>;
}
