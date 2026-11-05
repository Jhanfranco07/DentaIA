"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import TarjetaAccion from "@/components/TarjetaAccion";
import MisSolicitudes from "@/features/solicitudes/MisSolicitudes";
import { useSesion } from "@/features/cuenta/useSesion";
import EstadoPanel from "./EstadoPanel";
import ClinicaPanel from "./ClinicaPanel";
import ResumenPanel from "./ResumenPanel";
import ReporteDemo from "./ReporteDemo";
import styles from "./panel.module.css";

const ACCIONES = [
  { href: "/analisis?modo=camara", titulo: "Tomar fotografía", descripcion: "Activa la cámara cuando quieras preparar una imagen.", accion: "Preparar foto", icono: "camara" as const },
  { href: "/analisis?modo=subir", titulo: "Subir fotografía", descripcion: "Elige una imagen local para revisarla, sin cargarla.", accion: "Elegir imagen", icono: "subir" as const },
  { href: "/solicitudes", titulo: "Mis solicitudes", descripcion: "Consulta solicitudes de orientación y su estado.", accion: "Consultar solicitudes", icono: "calendario" as const },
  { href: "/directorio", titulo: "Explorar odontólogos", descripcion: "Revisa perfiles académicos disponibles en el directorio.", accion: "Abrir directorio", icono: "diente" as const },
] as const;

export default function PanelPaciente() {
  const { usuario, cargando, errorSesion, verificar } = useSesion();
  const nombre = usuario?.user_metadata?.full_name;
  const primerNombre = typeof nombre === "string" && nombre.trim() ? nombre.trim().split(/\s+/)[0] : "";

  return <section className={styles.pagina}>
    <header className={styles.cabecera}>
      <span className={styles.etiqueta}>Tu espacio de cuidado</span>
      <h1>{primerNombre ? `Hola, ${primerNombre}` : "Bienvenido a DentaIA"}</h1>
      <p>Prepara una fotografía, revisa tus solicitudes y encuentra orientación profesional desde un solo lugar.</p>
      <div className={styles.accionesCabecera}>
        <Link href="/analisis" className={styles.accionPrincipal}><Icono nombre="destello" size={17} /> Iniciar análisis dental</Link>
        <Link href="/resultados" className={styles.accionSecundaria}>Ver mis resultados <Icono nombre="reporte" size={16} /></Link>
      </div>
      <span className={styles.avisoMotor}>Motor de IA pendiente · sin diagnósticos automatizados</span>
    </header>

    {cargando ? <EstadoPanel tipo="cargando" titulo="Comprobando tu sesión…" /> : errorSesion ?
      <EstadoPanel tipo="error" titulo="No pudimos comprobar tu sesión." accion={<button type="button" className={styles.boton} onClick={() => void verificar()}>Reintentar sesión</button>} /> : !usuario ?
        <EstadoPanel tipo="vacio" titulo="Inicia sesión para acceder a tu panel." accion={<Link href="/cuenta" className={styles.enlace}>Ir a mi perfil</Link>}>No se muestran datos personales sin sesión.</EstadoPanel> : <Fragment key={usuario.id}>
          <ResumenPanel />
          <section aria-labelledby="acciones-rapidas-titulo" className={styles.accionesRapidas}>
            <div className={styles.encabezadoAcciones}><span className={styles.etiquetaSeccion}>SIGUIENTE PASO</span><h2 id="acciones-rapidas-titulo">¿Qué quieres hacer?</h2><p>El motor de IA todavía no está disponible; puedes revisar una foto sin enviarla.</p></div>
            <ul className={styles.grilla}>{ACCIONES.map(accion => <li key={accion.href}><TarjetaAccion {...accion} /></li>)}</ul>
          </section>
          <details className={styles.detalleClinico}><summary>Autorizaciones e historial clínico</summary><ClinicaPanel /></details>
          <ReporteDemo />
          <MisSolicitudes compacto />
        </Fragment>}
  </section>;
}
