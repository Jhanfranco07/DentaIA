"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Icono } from "@/components/Identidad";
import MisSolicitudes from "@/features/solicitudes/MisSolicitudes";
import { useSesion } from "@/features/cuenta/useSesion";
import EstadoPanel from "./EstadoPanel";
import ClinicaPanel from "./ClinicaPanel";
import ResumenPanel from "./ResumenPanel";
import styles from "./panel.module.css";

export default function PanelPaciente() {
  const { usuario, cargando, errorSesion, verificar } = useSesion();
  const nombre = usuario?.user_metadata?.full_name;
  const primerNombre = typeof nombre === "string" && nombre.trim() ? nombre.trim().split(/\s+/)[0] : "";

  return <section className={styles.pagina}>
    <header className={styles.cabecera}>
      <span className={styles.etiqueta}>Tu espacio personal</span>
      <h1>{primerNombre ? `Hola, ${primerNombre}` : "Bienvenido a DentaIA"}</h1>
      <p>Revisa tus solicitudes y organiza los próximos pasos de tu cuidado dental.</p>
      <div className={styles.accionesCabecera}>
        <Link href="/directorio" className={styles.accionPrincipal}>Explorar odontólogos <Icono nombre="flecha" size={18} /></Link>
      </div>
    </header>

    {cargando ? <EstadoPanel tipo="cargando" titulo="Comprobando tu sesión…" /> : errorSesion ?
      <EstadoPanel tipo="error" titulo="No pudimos comprobar tu sesión." accion={<button type="button" className={styles.boton} onClick={() => void verificar()}>Reintentar sesión</button>} /> : !usuario ?
        <EstadoPanel tipo="vacio" titulo="Inicia sesión para acceder a tu panel." accion={<Link href="/cuenta" className={styles.enlace}>Ir a mi perfil</Link>}>No se muestran datos personales sin sesión.</EstadoPanel> : <Fragment key={usuario.id}>
          <ResumenPanel />
          <div className={styles.contenidoPanel}>
            <div className={styles.actividad}>
              <MisSolicitudes compacto />
            </div>
            <aside className={styles.proximosPasos} aria-labelledby="proximos-pasos-titulo">
              <div className={styles.proximosEncabezado}>
                <h2 id="proximos-pasos-titulo">Continúa desde aquí</h2>
                <p>Accesos a tus herramientas personales.</p>
              </div>
              <Link href="/fotografias" className={styles.paso}>
                <span className={styles.pasoIcono}><Icono nombre="camara" size={20} /></span>
                <span><strong>Mis fotografías</strong><small>Consulta o elimina las que guardaste.</small></span>
                <Icono nombre="flecha" size={17} />
              </Link>
              <Link href="/analisis" className={styles.paso}>
                <span className={styles.pasoIcono}><Icono nombre="imagen" size={20} /></span>
                <span><strong>Preparar una fotografía</strong><small>Revísala localmente antes de continuar.</small></span>
                <Icono nombre="flecha" size={17} />
              </Link>
              <Link href="/cuenta" className={styles.paso}>
                <span className={styles.pasoIcono}><Icono nombre="persona" size={20} /></span>
                <span><strong>Mi perfil</strong><small>Revisa los datos de tu cuenta.</small></span>
                <Icono nombre="flecha" size={17} />
              </Link>
              <p className={styles.avisoMotor}>El análisis con IA aún no está disponible. No se generan diagnósticos automatizados.</p>
            </aside>
          </div>
          <details className={styles.detalleClinico}><summary>Autorizaciones e historial clínico</summary><ClinicaPanel /></details>
        </Fragment>}
  </section>;
}
