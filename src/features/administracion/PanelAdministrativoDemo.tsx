"use client";

import { useRef, useState } from "react";
import { Icono } from "@/components/Identidad";
import LayoutAdministrativo from "./LayoutAdministrativo";
import UsuariosAdministrativos from "./UsuariosAdministrativos";
import CambioRolesLocal from "./CambioRolesLocal";
import GestorUbicaciones from "./GestorUbicaciones";
import GestorVinculaciones from "./GestorVinculaciones";
import ModeracionResenas from "./ModeracionResenas";
import { useAccesoPanel } from "./UsuariosAdministrativosConectados";
import { fallo } from "./cliente";
import TarjetaAdministrativa from "./TarjetaAdministrativa";
import { SECCIONES_ADMINISTRATIVAS, type SeccionAdministrativa } from "./estructura";
import styles from "./administracion.module.css";

const ROLES_PREVISTOS = [
  { nombre: "Visitante", alcance: "Contenido público y directorio odontológico.", situacion: "Condición sin sesión" },
  { nombre: "Paciente", alcance: "Perfil, fotografías y solicitudes propios.", situacion: "Capacidades personales existentes" },
  { nombre: "Odontólogo", alcance: "Atención autorizada, limitada por paciente y clínica.", situacion: "Verificación profesional y autorización clínica independientes" },
  { nombre: "Superusuario", alcance: "Administración no clínica de cuentas y roles.", situacion: "Sesión autorizada y MFA/AAL2" },
] as const;

// Nombre histórico de DI-149; la composición actual consume los servicios de DI-151.
export default function PanelAdministrativoDemo() {
  const [seccion, setSeccion] = useState<SeccionAdministrativa>("inicio");
  const [objetivo, setObjetivo] = useState("");
  const [revision, setRevision] = useState(0);
  const { invalidar } = useAccesoPanel();
  const titulo = useRef<HTMLHeadingElement>(null);
  const actual = SECCIONES_ADMINISTRATIVAS.find(item => item.id === seccion)!;

  function seleccionar(destino: SeccionAdministrativa) {
    setSeccion(destino);
    requestAnimationFrame(() => titulo.current?.focus());
  }

  return <section className={styles.pagina} aria-label="Panel administrativo protegido">
    <LayoutAdministrativo seccion={seccion} onSeleccionar={seleccionar}>
      <div className={styles.introduccion}>
        <h1 id="admin-titulo" ref={titulo} tabIndex={-1}>{seccion === "inicio" ? "Panel administrativo" : actual.titulo}</h1>
        <p>{seccion === "inicio"
          ? "Consulta usuarios y accede a las tareas administrativas disponibles para tu cuenta."
          : actual.descripcion + ". Cada solicitud vuelve a comprobar la autorización del servidor."}</p>
      </div>

      {seccion === "inicio" && <>
        <div className={styles.tarjetas} aria-label="Tareas principales">
          <TarjetaAdministrativa titulo="Usuarios" icono="persona"
            descripcion="Busca cuentas y revisa su perfil, estado y asignaciones cuando la lectura está habilitada."
            accion="Consultar usuarios" onAbrir={() => seleccionar("usuarios")} />
          <TarjetaAdministrativa titulo="Consultorios" icono="clinica"
            descripcion="Consulta las sedes y utiliza las operaciones disponibles según tus permisos."
            accion="Gestionar consultorios" onAbrir={() => seleccionar("ubicaciones")} />
        </div>
      </>}

      {seccion === "usuarios" && <UsuariosAdministrativos revision={revision} onSeleccionar={id => { setObjetivo(id); seleccionar("roles"); }} />}

      {seccion === "roles" && <section className={styles.bloque} aria-labelledby="admin-roles">
        <div className={styles.tituloBloque}><h2 id="admin-roles">Perfiles previstos del sistema</h2><span className={styles.indicador}>Referencia de DI-148</span></div>
        <p>Esta referencia explica el diseño. No muestra asignaciones persistidas ni concede permisos a la sesión actual.</p>
        <ul className={styles.roles}>{ROLES_PREVISTOS.map(rol => <li key={rol.nombre}>
          <div><h3>{rol.nombre}</h3><p>{rol.alcance}</p></div><span>{rol.situacion}</span>
        </li>)}</ul>
        <CambioRolesLocal key={objetivo} usuarioInicial={objetivo} embebido onCambioConfirmado={() => setRevision(v => v + 1)}
          onAccesoDenegado={status => invalidar(fallo(status, "ERROR_API"))} />
        <button type="button" className={styles.accionEstado} onClick={() => seleccionar("usuarios")}>Volver a consultar usuarios</button>
      </section>}

      {seccion === "ubicaciones" && <GestorUbicaciones />}
      {seccion === "vinculaciones" && <GestorVinculaciones />}
      {seccion === "resenas" && <ModeracionResenas />}

      <aside className={styles.limiteClinico} aria-labelledby="admin-limite">
        <Icono nombre="escudo" size={23} />
        <div><h2 id="admin-limite">Administración y atención clínica, con límites distintos.</h2>
          <p>Ser superusuario no concederá acceso automático a fotografías, resultados o historiales de otras personas.</p></div>
      </aside>
    </LayoutAdministrativo>
  </section>;
}
