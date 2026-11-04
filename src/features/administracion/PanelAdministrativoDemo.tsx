"use client";

import { useRef, useState } from "react";
import { Icono } from "@/components/Identidad";
import LayoutAdministrativo from "./LayoutAdministrativo";
import UsuariosAdministrativos from "./UsuariosAdministrativos";
import CambioRolesLocal from "./CambioRolesLocal";
import { useAccesoPanel } from "./UsuariosAdministrativosConectados";
import { fallo } from "./cliente";
import TarjetaAdministrativa from "./TarjetaAdministrativa";
import { SECCIONES_ADMINISTRATIVAS, type SeccionAdministrativa } from "./estructura";
import styles from "./administracion.module.css";

const ROLES_PREVISTOS = [
  { nombre: "Visitante", alcance: "Contenido público y demostración educativa.", situacion: "Condición sin sesión" },
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
    <div className={styles.avisoDemo}>
      <strong>DI-152 · Integración administrativa</strong>
      <p>Panel local conectado a los servicios administrativos existentes. La configuración académica compartida mantiene lecturas y escrituras desactivadas; una operación bloqueada se muestra como error, nunca como simulación o éxito.</p>
    </div>
    <LayoutAdministrativo seccion={seccion} onSeleccionar={seleccionar}>
      <div className={styles.introduccion}>
        <span className="eyebrow">PANEL ADMINISTRATIVO · ACCESO VERIFICADO POR EL SERVIDOR</span>
        <h1 id="admin-titulo" ref={titulo} tabIndex={-1}>{seccion === "inicio" ? "Un espacio para organizar DentaIA." : actual.titulo}</h1>
        <p>{seccion === "inicio"
          ? "Consulta perfiles y gestiona únicamente operaciones autorizadas, con responsabilidades claras y acceso mínimo."
          : actual.descripcion + ". Cada solicitud vuelve a comprobar la autorización del servidor."}</p>
      </div>

      {seccion === "inicio" && <>
        <div className={styles.tarjetas}>
          <TarjetaAdministrativa titulo="Usuarios" icono="persona"
            descripcion="Espacio previsto para organizar la identidad y el estado de las cuentas. Sin acceso a fotografías ni historiales."
            accion="Consultar usuarios" onAbrir={() => seleccionar("usuarios")} />
          <TarjetaAdministrativa titulo="Roles y permisos" icono="escudo"
            descripcion="Referencia de los perfiles del sistema y sus límites, basada en la matriz de permisos de DI-148."
            accion="Consultar roles y permisos" onAbrir={() => seleccionar("roles")} />
        </div>
        <section className={styles.bloque} aria-labelledby="admin-alcance">
          <h2 id="admin-alcance">Servicios y restricciones</h2>
          <ul className={styles.pasos}>
            <li><span>01</span><div><strong>Usuarios reales</strong><p>Auth y profiles mediante la API protegida. Requiere habilitación de lectura del operador; sin credenciales privadas en React.</p></div></li>
            <li><span>02</span><div><strong>Cambios controlados</strong><p>Reutilizan revisión, aprobación independiente e idempotencia de DI-151. No se activa la escritura desde esta pantalla.</p></div></li>
            <li><span>03</span><div><strong>Autorización por operación</strong><p>Superusuario activo y MFA/AAL2. Cambiar una sección o un UUID no concede permisos.</p></div></li>
          </ul>
        </section>
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

      <aside className={styles.limiteClinico} aria-labelledby="admin-limite">
        <Icono nombre="escudo" size={23} />
        <div><h2 id="admin-limite">Administración y atención clínica, con límites distintos.</h2>
          <p>Ser superusuario no concederá acceso automático a fotografías, resultados o historiales de otras personas.</p></div>
      </aside>
    </LayoutAdministrativo>
  </section>;
}
