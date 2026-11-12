import Image from "next/image";
import { Icono } from "@/components/Identidad";
import styles from "./directorio.module.css";

export default function HeroDirectorioPaciente() {
  return <header className={styles.heroPremium}>
    <div className={styles.heroPremiumCopy}>
      <span className={styles.heroPremiumEyebrow}><Icono nombre="diente" size={17}/> ODONTÓLOGOS</span>
      <h1>Encuentra orientación <span>odontológica</span></h1>
      <p>Busca por nombre, especialidad o distrito y explora ubicaciones de referencia en Lima.</p>
      <div className={styles.heroPremiumAcciones}>
        <a href="#resultados-directorio" className={styles.heroPremiumCTA}>Explorar perfiles <Icono nombre="flecha" size={18}/></a>
      </div>
      <small className={styles.heroPremiumNota}>Los perfiles ilustrados son ficticios y no están vinculados laboralmente a los centros geográficos mostrados. No se gestionan citas con ellos.</small>
    </div>
    <div className={styles.heroPremiumArte} aria-hidden="true">
      <Image src="/directorio/hero-odontologos-premium.avif" alt="" width={740} height={690} priority
        sizes="(max-width: 760px) 180px, (max-width: 1310px) 235px, 350px"
        className={styles.heroPremiumImagen}/>
    </div>
    <aside className={styles.heroPremiumDatos} aria-label="Explora el directorio">
      <span className={styles.heroPremiumDatosTitulo}>Cómo explorar el directorio</span>
      <div><span className={styles.heroPremiumMiniIcono}><Icono nombre="usuarios" size={18}/></span><span><strong>Busca un perfil</strong><small>Combina la búsqueda con los filtros.</small></span></div>
      <div><span className={styles.heroPremiumMiniIcono}><Icono nombre="ubicacion" size={18}/></span><span><strong>Mapa interactivo</strong><small>Consulta los centros de referencia.</small></span></div>
      <div><span className={styles.heroPremiumMiniIcono}><Icono nombre="privacidad" size={18}/></span><span><strong>Ordena por cercanía</strong><small>Activa tu ubicación si lo deseas.</small></span></div>
    </aside>
  </header>;
}
