import Link from "next/link";
import { Icono } from "@/components/Identidad";
import styles from "./mis-resultados.module.css";

export default function MisResultados() {
  return <section className={styles.pagina}>
    <header className={styles.encabezado}>
      <span className={styles.etiqueta}><Icono nombre="reporte" size={15} /> ESPACIO PERSONAL</span>
      <h1>Mis resultados</h1>
      <p>Cuando el motor de análisis esté integrado, aquí aparecerán tus resultados reales y su información de contexto.</p>
    </header>
    <section className={styles.vacio} aria-labelledby="resultados-vacios">
      <span className={styles.icono}><Icono nombre="imagen" size={30} /></span>
      <span className={styles.estado}>SIN ANÁLISIS REGISTRADOS</span>
      <h2 id="resultados-vacios">Aún no tienes análisis realizados</h2>
      <p>Esta funcionalidad estará disponible cuando se integre el motor de IA. No se mostrarán resultados educativos como si fueran análisis de tu fotografía.</p>
      <div className={styles.acciones}><Link href="/analisis" className={styles.primario}><Icono nombre="destello" size={17} /> Preparar una fotografía</Link><Link href="/directorio" className={styles.secundario}>Encontrar odontólogos <Icono nombre="flecha" size={16} /></Link></div>
    </section>
  </section>;
}
