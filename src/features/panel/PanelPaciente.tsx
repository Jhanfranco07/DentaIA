"use client";

import { Fragment } from "react";
import MisSolicitudes from "@/features/solicitudes/MisSolicitudes";
import { useSesion } from "@/features/cuenta/useSesion";
import EstadoPanel from "./EstadoPanel";
import ClinicaPanel from "./ClinicaPanel";
import Link from "next/link";
import ResumenPanel from "./ResumenPanel";
import ReporteDemo from "./ReporteDemo";
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
  const { usuario, cargando, errorSesion, verificar } = useSesion();
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

      {cargando ? <EstadoPanel tipo="cargando" titulo="Comprobando tu sesión…" /> : errorSesion ?
        <EstadoPanel tipo="error" titulo="No pudimos comprobar tu sesión." accion={<button type="button" className={styles.boton} onClick={() => void verificar()}>Reintentar sesión</button>} /> : !usuario ?
        <EstadoPanel tipo="vacio" titulo="Inicia sesión para acceder a tu panel." accion={<Link href="/cuenta" className={styles.enlace}>Ir a mi cuenta</Link>}>No se muestran datos personales sin sesión.</EstadoPanel> : <Fragment key={usuario.id}>
      <ResumenPanel />

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

      <ClinicaPanel />

      <ReporteDemo />

      <MisSolicitudes />
      </Fragment>}
    </section>
  );
}
