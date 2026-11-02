"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EstadoAdministrativo from "./EstadoAdministrativo";
import PropuestaRolDemo from "./PropuestaRolDemo";
import { crearProveedorAdministrativoSimulado, type EscenarioAdministrativo, type PaginaUsuarios } from "./servicios";
import styles from "./administracion.module.css";

export default function UsuariosAdministrativosDemo() {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState("todos");
  const [estado, setEstado] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [escenario, setEscenario] = useState<EscenarioAdministrativo>("normal");
  const [resultado, setResultado] = useState<PaginaUsuarios | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const resumen = useRef<HTMLParagraphElement>(null);
  const enfocarResumen = useRef(false);
  const proveedor = useMemo(() => crearProveedorAdministrativoSimulado({ escenario, demoraMs: 220 }), [escenario]);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(""); setResultado(null);
    proveedor.listar({ q, rol, estado, pagina, tamano: 5 }).then(respuesta => {
      if (!vigente) return;
      if (respuesta.ok) setResultado(respuesta.valor); else setError(respuesta.mensaje);
    }).catch(() => { if (vigente) setError("No se pudo consultar el proveedor simulado."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [proveedor, q, rol, estado, pagina]);
  useEffect(() => {
    if (!cargando && resultado && enfocarResumen.current) { resumen.current?.focus(); enfocarResumen.current = false; }
  }, [cargando, resultado]);
  function filtrar(cambiar: () => void) { enfocarResumen.current = false; cambiar(); setPagina(1); }
  function cambiarPagina(destino: number) { enfocarResumen.current = true; setPagina(destino); }
  return <section className={styles.bloque} aria-labelledby="admin-usuarios">
    <div className={styles.tituloBloque}><h2 id="admin-usuarios">Organización de cuentas</h2><span className={styles.indicador}>Proveedor simulado</span></div>
    <p>Datos sintéticos en memoria. Ninguna cuenta, rol o estado de este listado procede de Supabase. No se muestran correos ni datos clínicos.</p>
    <div className={styles.filtrosAdmin}>
      <label>Búsqueda por alias o UUID<input type="search" value={q} maxLength={80} onChange={event => filtrar(() => setQ(event.target.value))} /></label>
      <label>Filtrar por rol<select value={rol} onChange={event => filtrar(() => setRol(event.target.value))}>
        <option value="todos">Todos los roles</option><option value="paciente">Paciente</option><option value="odontologo">Odontólogo</option>
        <option value="superusuario">Superusuario</option><option value="sin_asignacion">Sin asignación</option>
      </select></label>
      <label>Filtrar por estado<select value={estado} onChange={event => filtrar(() => setEstado(event.target.value))}>
        <option value="todos">Todos los estados</option><option value="activo">Activo</option><option value="suspendido">Suspendido</option>
      </select></label>
      <label>Escenario de demostración<select value={escenario} onChange={event => filtrar(() => setEscenario(event.target.value as EscenarioAdministrativo))}>
        <option value="normal">Listado sintético</option><option value="vacio">Vacío simulado</option><option value="error">Error simulado</option>
      </select></label>
    </div>
    {cargando ? <EstadoAdministrativo estado="carga" /> : error ? <>
      <EstadoAdministrativo estado="error" onReintentar={() => filtrar(() => setEscenario("normal"))} />
      <p className={styles.errorAdmin}>{error}</p>
    </> : resultado && <>
      <p ref={resumen} tabIndex={-1} role="status" className={styles.resumenAdmin}>{resultado.total} cuentas sintéticas · Página {resultado.pagina} de {resultado.paginas}</p>
      {resultado.usuarios.length === 0 ? <EstadoAdministrativo estado="vacio" /> : <div className={styles.tablaUsuarios} role="region" aria-label="Listado de cuentas sintéticas desplazable" tabIndex={0}>
        <table className={styles.tabla}>
          <caption className="sr-only">Cuentas ficticias: asignaciones simuladas, sin roles persistidos en Supabase</caption>
          <thead><tr><th scope="col">Identidad sintética</th><th scope="col">Roles de ejemplo</th><th scope="col">Estado de ejemplo</th></tr></thead>
          <tbody>{resultado.usuarios.map(usuario => <tr key={usuario.id}>
            <td><strong>{usuario.etiqueta}</strong><small>{usuario.id}</small>
              <button type="button" className={styles.enlaceBoton} aria-label={`Preparar propuesta para ${usuario.etiqueta}`} onClick={() => {
                setObjetivo(usuario.id);
                requestAnimationFrame(() => document.getElementById("demo-propuesta-rol")?.focus());
              }}>Preparar propuesta</button>
            </td>
            <td>{usuario.roles.length ? usuario.roles.map(valor => valor === "odontologo" ? "Odontólogo" : valor === "superusuario" ? "Superusuario" : "Paciente").join(", ") : "Sin asignación de ejemplo"}
              <small>Simulado · no persistido</small></td>
            <td>{usuario.estado === "activo" ? "Activo" : "Suspendido"}<small>Estado simulado</small></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav className={styles.paginacionAdmin} aria-label="Paginación de cuentas sintéticas">
        <button type="button" className={styles.accionEstado} disabled={resultado.pagina <= 1} onClick={() => cambiarPagina(resultado.pagina - 1)}>Anterior</button>
        <button type="button" className={styles.accionEstado} disabled={resultado.pagina >= resultado.paginas} onClick={() => cambiarPagina(resultado.pagina + 1)}>Siguiente</button>
      </nav>
    </>}
    <PropuestaRolDemo proveedor={proveedor} objetivo={objetivo} onObjetivo={setObjetivo} />
    <p className={styles.aclaracion}>Los cambios reales de rol están bloqueados. La fuente futura deberá consultar asignaciones confiables y distinguirlas de estos ejemplos.</p>
  </section>;
}
