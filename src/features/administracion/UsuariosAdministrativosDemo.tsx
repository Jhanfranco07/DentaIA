"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EstadoAdministrativo from "./EstadoAdministrativo";
import PropuestaRolDemo from "./PropuestaRolDemo";
import { ACTOR_ADMINISTRATIVO_DEMO, crearProveedorAdministrativoSimulado, type EscenarioAdministrativo, type PaginaUsuarios } from "./servicios";
import { esDenegacionDeAcceso } from "./cliente";
import type { ClientePanelAdministrativo, ErrorClienteAdministrativo } from "./cliente";
import styles from "./administracion.module.css";

type Props = { cliente?: ClientePanelAdministrativo; onAccesoDenegado?: (error: ErrorClienteAdministrativo) => void };
export default function UsuariosAdministrativosDemo({ cliente, onAccesoDenegado }: Props) {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [escenario, setEscenario] = useState<EscenarioAdministrativo>("normal");
  const [resultado, setResultado] = useState<PaginaUsuarios | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [reintento, setReintento] = useState(0);
  const resumen = useRef<HTMLParagraphElement>(null);
  const enfocarResumen = useRef(false);
  const local = useMemo<ClientePanelAdministrativo>(() => {
    const p = crearProveedorAdministrativoSimulado({ escenario, demoraMs: 220 });
    return { listar: p.listar, validarPropuesta: entrada => p.validarPropuesta(entrada, ACTOR_ADMINISTRATIVO_DEMO) };
  }, [escenario]);
  const proveedor = cliente ?? local;
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(""); setResultado(null);
    proveedor.listar({ q, rol, estado, pagina, tamano: 5 }).then(respuesta => {
      if (!vigente) return;
      if (respuesta.ok) setResultado(respuesta.valor);
      else { setError(respuesta.mensaje); if (esDenegacionDeAcceso(respuesta)) onAccesoDenegado?.(respuesta); }
    }).catch(() => { if (vigente) setError("No se pudo consultar la fuente seleccionada."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [proveedor, q, rol, estado, pagina, reintento, onAccesoDenegado]);
  useEffect(() => {
    if (!cargando && resultado && enfocarResumen.current) { resumen.current?.focus(); enfocarResumen.current = false; }
  }, [cargando, resultado]);
  function filtrar(cambiar: () => void) { enfocarResumen.current = false; cambiar(); setPagina(1); }
  function cambiarPagina(destino: number) { enfocarResumen.current = true; setPagina(destino); }
  return <section className={styles.bloque} aria-labelledby="admin-usuarios">
    <div className={styles.tituloBloque}><h2 id="admin-usuarios">Organización de cuentas</h2><span className={styles.indicador}>{cliente ? "Canal API protegido" : "Proveedor simulado local"}</span></div>
    <p>{cliente ? "La API exige autorización en cada petición. Consulta el origen indicado en la respuesta: conectar el transporte no convierte el proveedor sintético en datos reales." : "Datos sintéticos en memoria, sin peticiones administrativas ni consultas a Supabase."} No se muestran correos ni datos clínicos.</p>
    <div className={styles.filtrosAdmin}>
      <label>Búsqueda por alias o UUID<input type="search" value={q} maxLength={80} onChange={event => filtrar(() => setQ(event.target.value))} /></label>
      <label>Filtrar por rol<select value={rol} onChange={event => filtrar(() => setRol(event.target.value))}>
        <option value="todos">Todos los roles</option><option value="paciente">Paciente</option><option value="odontologo">Odontólogo</option>
        <option value="superusuario">Superusuario</option><option value="sin_asignacion">Sin asignación</option>
      </select></label>
      <label>Filtrar por estado<select value={estado} onChange={event => filtrar(() => setEstado(event.target.value))}>
        <option value="todos">Todos los estados</option><option value="activo">Activo</option><option value="suspendido">Suspendido</option>
      </select></label>
      {!cliente && <label>Escenario de demostración<select value={escenario} onChange={event => filtrar(() => setEscenario(event.target.value as EscenarioAdministrativo))}>
        <option value="normal">Listado sintético</option><option value="vacio">Vacío simulado</option><option value="error">Error simulado</option>
      </select></label>}
    </div>
    {cargando ? <EstadoAdministrativo estado="carga" /> : error ? <>
      <EstadoAdministrativo estado="error" reintentarTexto={cliente ? "Volver a consultar" : "Reintentar simulación"} onReintentar={() => { if (!cliente) setEscenario("normal"); setReintento(v => v + 1); }} />
      <p className={styles.errorAdmin}>{error}</p>
    </> : resultado && <>
      <p ref={resumen} tabIndex={-1} role="status" className={styles.resumenAdmin}>{resultado.total} cuentas · Origen {resultado.origen === "sintetico" ? "sintético, no real" : "Supabase"} · Página {resultado.pagina} de {resultado.paginas}</p>
      {resultado.usuarios.length === 0 ? <EstadoAdministrativo estado="vacio" /> : <div className={styles.tablaUsuarios} role="region" aria-label="Listado administrativo desplazable" tabIndex={0}>
        <table className={styles.tabla}>
          <caption className="sr-only">{resultado.origen === "sintetico" ? "Cuentas ficticias: asignaciones simuladas, sin roles persistidos en Supabase" : "Cuentas de la fuente administrativa autorizada"}</caption>
          <thead><tr><th scope="col">Identidad</th><th scope="col">Asignaciones</th><th scope="col">Estado</th></tr></thead>
          <tbody>{resultado.usuarios.map(usuario => <tr key={usuario.id}>
            <td><strong>{usuario.etiqueta}</strong><small>{usuario.id}</small>
              <button type="button" className={styles.enlaceBoton} aria-label={`Preparar propuesta para ${usuario.etiqueta}`} onClick={() => {
                setObjetivo(usuario.id);
                requestAnimationFrame(() => document.getElementById("demo-propuesta-rol")?.focus());
              }}>Preparar propuesta</button>
            </td>
            <td>{usuario.roles.length ? usuario.roles.map(valor => valor === "odontologo" ? "Odontólogo" : valor === "superusuario" ? "Superusuario" : "Paciente").join(", ") : "Sin asignación de ejemplo"}
              <small>{usuario.origenRoles === "sintetico" ? "Simulado · no persistido" : usuario.origenRoles === "persistido" ? "Asignación persistida" : "Sin asignación"}</small></td>
            <td>{usuario.estado === "activo" ? "Activo" : "Suspendido"}<small>{resultado.origen === "sintetico" ? "Estado simulado" : "Estado del proveedor"}</small></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav className={styles.paginacionAdmin} aria-label="Paginación del listado administrativo">
        <button type="button" className={styles.accionEstado} disabled={resultado.pagina <= 1} onClick={() => cambiarPagina(resultado.pagina - 1)}>Anterior</button>
        <button type="button" className={styles.accionEstado} disabled={resultado.pagina >= resultado.paginas} onClick={() => cambiarPagina(resultado.pagina + 1)}>Siguiente</button>
      </nav>
    </>}
    <PropuestaRolDemo proveedor={proveedor} objetivo={objetivo} onObjetivo={setObjetivo} conectado={Boolean(cliente)} onAccesoDenegado={onAccesoDenegado} />
    <p className={styles.aclaracion}>Los cambios reales de rol están bloqueados. La fuente futura deberá consultar asignaciones confiables y distinguirlas de estos ejemplos.</p>
  </section>;
}
