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
      <span className={styles.etiqueta}>Tu espacio de cuidado</span>
      <h1>{primerNombre ? `Hola, ${primerNombre}` : "Bienvenido a DentaIA"}</h1>
      <p>Prepara una fotografía, revisa tus solicitudes y encuentra orientación profesional desde un solo lugar.</p>
      <div className={styles.accionesCabecera}>
        <Link href="/analisis" className={styles.accionPrincipal}><Icono nombre="destello" size={17} /> Iniciar análisis dental</Link>
        <Link href="/directorio" className={styles.accionSecundaria}>Encontrar odontólogos <Icono nombre="diente" size={16} /></Link>
        <Link href="/solicitudes" className={styles.accionSecundaria}>Consultar solicitudes <Icono nombre="calendario" size={16} /></Link>
      </div>
      <span className={styles.avisoMotor}>Motor de IA pendiente · sin diagnósticos automatizados</span>
    </header>

    {cargando ? <EstadoPanel tipo="cargando" titulo="Comprobando tu sesión…" /> : errorSesion ?
      <EstadoPanel tipo="error" titulo="No pudimos comprobar tu sesión." accion={<button type="button" className={styles.boton} onClick={() => void verificar()}>Reintentar sesión</button>} /> : !usuario ?
        <EstadoPanel tipo="vacio" titulo="Inicia sesión para acceder a tu panel." accion={<Link href="/cuenta" className={styles.enlace}>Ir a mi perfil</Link>}>No se muestran datos personales sin sesión.</EstadoPanel> : <Fragment key={usuario.id}>
          <ResumenPanel />
          <details className={styles.detalleClinico}><summary>Autorizaciones e historial clínico</summary><ClinicaPanel /></details>
          <MisSolicitudes compacto />
        </Fragment>}
  </section>;
}
