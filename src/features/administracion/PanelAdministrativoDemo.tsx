"use client";

import { useRef, useState } from "react";
import { Icono } from "@/components/Identidad";
import LayoutAdministrativo from "./LayoutAdministrativo";
import TarjetaAdministrativa from "./TarjetaAdministrativa";
import { SECCIONES_ADMINISTRATIVAS, type SeccionAdministrativa } from "./estructura";
import styles from "./administracion.module.css";

const ROLES_PREVISTOS = [
  { nombre: "Visitante", alcance: "Contenido público y demostración educativa.", situacion: "Condición sin sesión" },
  { nombre: "Paciente", alcance: "Perfil, fotografías y solicitudes propios.", situacion: "Capacidades personales existentes" },
  { nombre: "Odontólogo", alcance: "Atención autorizada, limitada por paciente y clínica.", situacion: "Rol autenticado por incorporar" },
  { nombre: "Superusuario", alcance: "Administración no clínica de cuentas y roles.", situacion: "Rol autenticado por incorporar" },
] as const;

// Solo presentación y navegación en memoria. No importa Auth, servicios ni clientes de datos.
export default function PanelAdministrativoDemo() {
  const [seccion, setSeccion] = useState<SeccionAdministrativa>("inicio");
  const titulo = useRef<HTMLHeadingElement>(null);
  const actual = SECCIONES_ADMINISTRATIVAS.find(item => item.id === seccion)!;

  function seleccionar(destino: SeccionAdministrativa) {
    setSeccion(destino);
    requestAnimationFrame(() => titulo.current?.focus());
  }

  return <section className={styles.pagina} aria-label="Demostración local de estructura administrativa">
    <div className={styles.avisoDemo}>
      <strong>DI-149 · Primera parte del diseño</strong>
      <p>Demostración visual disponible solo en desarrollo. No consulta usuarios, no asigna roles y no accede a información clínica.</p>
    </div>
    <LayoutAdministrativo seccion={seccion} onSeleccionar={seleccionar}>
      <div className={styles.introduccion}>
        <span className="eyebrow">PANEL ADMINISTRATIVO · ESTRUCTURA INICIAL</span>
        <h1 ref={titulo} tabIndex={-1}>{seccion === "inicio" ? "Un espacio para organizar DentaIA." : actual.titulo}</h1>
        <p>{seccion === "inicio"
          ? "Una base visual para la futura administración de cuentas y permisos, con responsabilidades claras y acceso mínimo."
          : actual.descripcion + ". Solo presentación: las funciones de gestión todavía no están conectadas."}</p>
      </div>

      {seccion === "inicio" && <>
        <div className={styles.tarjetas}>
          <TarjetaAdministrativa titulo="Usuarios" icono="persona"
            descripcion="Espacio previsto para organizar la identidad y el estado de las cuentas. Sin acceso a fotografías ni historiales."
            accion="Ver estructura de usuarios" onAbrir={() => seleccionar("usuarios")} />
          <TarjetaAdministrativa titulo="Roles y permisos" icono="escudo"
            descripcion="Referencia de los perfiles del sistema y sus límites, basada en la matriz de permisos de DI-148."
            accion="Ver estructura de roles" onAbrir={() => seleccionar("roles")} />
        </div>
        <section className={styles.bloque} aria-labelledby="admin-alcance">
          <h2 id="admin-alcance">Antes de activar la administración</h2>
          <ul className={styles.pasos}>
            <li><span>01</span><div><strong>Estructura visual</strong><p>Layout, navegación y espacios de trabajo. Esta es la entrega del primer día de DI-149.</p></div></li>
            <li><span>02</span><div><strong>Continuación del diseño</strong><p>Completar adaptación responsive, estados visuales y revisión de navegación en la siguiente parte.</p></div></li>
            <li><span>03</span><div><strong>Acceso administrativo seguro</strong><p>La autenticación y autorización se abordarán en DI-150 antes de habilitar un panel real.</p></div></li>
          </ul>
        </section>
      </>}

      {seccion === "usuarios" && <section className={styles.bloque} aria-labelledby="admin-usuarios">
        <div className={styles.tituloBloque}><h2 id="admin-usuarios">Organización de cuentas</h2><span className={styles.indicador}>Sin conexión de datos</span></div>
        <p>Distribución inicial de la futura lista. No son cuentas reales ni un listado vacío obtenido de la base de datos.</p>
        <div className={styles.tablaContenedor}>
          <table className={styles.tabla}>
            <caption className="sr-only">Columnas previstas para la gestión de usuarios; sin registros</caption>
            <thead><tr><th scope="col">Identidad</th><th scope="col">Asignaciones</th><th scope="col">Estado de cuenta</th></tr></thead>
            <tbody><tr><td colSpan={3} className={styles.espacioDatos}>
              <Icono nombre="persona" size={28} /><strong>Aquí se organizarán las cuentas</strong>
              <span>La consulta y las acciones se incorporarán después de implementar los controles de acceso correspondientes.</span>
            </td></tr></tbody>
          </table>
        </div>
        <p className={styles.aclaracion}>No se incluyen invitaciones, cambios de estado ni edición de usuarios en esta parte.</p>
      </section>}

      {seccion === "roles" && <section className={styles.bloque} aria-labelledby="admin-roles">
        <div className={styles.tituloBloque}><h2 id="admin-roles">Perfiles previstos del sistema</h2><span className={styles.indicador}>Referencia de DI-148</span></div>
        <p>Esta referencia explica el diseño. No muestra asignaciones persistidas ni concede permisos a la sesión actual.</p>
        <ul className={styles.roles}>{ROLES_PREVISTOS.map(rol => <li key={rol.nombre}>
          <div><h3>{rol.nombre}</h3><p>{rol.alcance}</p></div><span>{rol.situacion}</span>
        </li>)}</ul>
        <p className={styles.aclaracion}>La edición y asignación de roles no están disponibles en esta demostración.</p>
      </section>}

      <aside className={styles.limiteClinico} aria-labelledby="admin-limite">
        <Icono nombre="escudo" size={23} />
        <div><h2 id="admin-limite">Administración y atención clínica, con límites distintos.</h2>
          <p>Ser superusuario no concederá acceso automático a fotografías, resultados o historiales de otras personas.</p></div>
      </aside>
    </LayoutAdministrativo>
  </section>;
}
