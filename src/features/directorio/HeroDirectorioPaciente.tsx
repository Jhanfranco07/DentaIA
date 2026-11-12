import Image from "next/image";
import { Icono } from "@/components/Identidad";
import styles from "./directorio.module.css";

export default function HeroDirectorioPaciente() {
  return <header className={styles.heroPremium}>
    <div className={styles.heroPremiumCopy}>
      <span className={styles.heroPremiumEyebrow}><Icono nombre="diente" size={17}/> DIRECTORIO ODONTOLÓGICO</span>
      <h1>Tu sonrisa merece <span>una buena orientación.</span></h1>
      <p>Explora especialidades, descubre perfiles odontológicos y consulta ubicaciones de referencia en Lima, desde tu propio espacio.</p>
      <div className={styles.heroPremiumAcciones}>
        <a href="#resultados-directorio" className={styles.heroPremiumCTA}>Explorar perfiles <Icono nombre="flecha" size={18}/></a>
        <span><Icono nombre="escudo" size={16}/> Búsqueda a tu ritmo</span>
      </div>
      <small className={styles.heroPremiumNota}>Los perfiles ilustrados son ficticios y no están vinculados laboralmente a los centros geográficos mostrados. No se gestionan citas con ellos.</small>
    </div>
    <div className={styles.heroPremiumArte} aria-hidden="true">
      <Image src="/directorio/hero-odontologos-premium.avif" alt="" width={740} height={690} priority
        sizes="(max-width: 760px) 180px, (max-width: 1310px) 235px, 350px"
        className={styles.heroPremiumImagen}/>
    </div>
    <aside className={styles.heroPremiumDatos} aria-label="Explora el directorio">
      <span className={styles.heroPremiumDatosTitulo}>Descubre tu próximo paso</span>
      <div><span className={styles.heroPremiumMiniIcono}><Icono nombre="usuarios" size={18}/></span><span><strong>Perfiles odontológicos</strong><small>Nombres y especialidades para explorar</small></span></div>
      <div><span className={styles.heroPremiumMiniIcono}><Icono nombre="ubicacion" size={18}/></span><span><strong>Mapa interactivo</strong><small>Centros y direcciones de referencia</small></span></div>
      <div><span className={styles.heroPremiumMiniIcono}><Icono nombre="privacidad" size={18}/></span><span><strong>Cercanía con tu permiso</strong><small>Activa el radar cuando quieras</small></span></div>
    </aside>
  </header>;
}
