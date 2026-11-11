"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { crearClientePanelReal } from "./cliente-panel-real";
import { esDenegacionDeAcceso } from "./cliente";
import { useAccesoPanel } from "./UsuariosAdministrativosConectados";
import type { PaginaUsuariosReales } from "./usuarios-reales";
import EstadoAdministrativo from "./EstadoAdministrativo";
import styles from "./administracion.module.css";

const ESTADOS_CUENTA = { habilitada: "Habilitada", suspendida: "Suspendida", sin_confirmar: "Sin confirmar", anonima: "Anónima", eliminada: "Eliminada", inconsistente: "Inconsistente" };
const ESTADOS_ASIGNACION = { activa: "Asignación activa", suspendida: "Asignación suspendida", ausente: "Sin asignación", invalida: "Asignación inválida" };

export default function UsuariosAdministrativos({ onSeleccionar, revision }: { onSeleccionar: (id: string) => void; revision: number }) {
  const { invalidar } = useAccesoPanel();
  const [q, setQ] = useState(""), [rol, setRol] = useState("todos"), [estado, setEstado] = useState("todos");
  const [pagina, setPagina] = useState(1), [tamano, setTamano] = useState(5), [reintento, setReintento] = useState(0);
  const [resultado, setResultado] = useState<PaginaUsuariosReales | null>(null), [error, setError] = useState(""), [cargando, setCargando] = useState(true);
  const resumen = useRef<HTMLParagraphElement>(null), enfocar = useRef(false);
  const cliente = useMemo(() => crearClientePanelReal(async () => {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }), []);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setResultado(null); setError("");
    void cliente.listar({ q, rol, estado, pagina, tamano }).then(r => {
      if (!vigente) return;
      if (r.ok) setResultado(r.valor);
      else { setError(r.status === 503 ? "La lectura administrativa está desactivada o no disponible. No se muestran datos simulados." : r.mensaje); if (esDenegacionDeAcceso(r)) invalidar(r); }
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cliente, invalidar, q, rol, estado, pagina, tamano, revision, reintento]);
  useEffect(() => { if (!cargando && resultado && enfocar.current) { resumen.current?.focus(); enfocar.current = false; } }, [cargando, resultado]);
  function filtrar(cambio: () => void) { cambio(); setPagina(1); enfocar.current = false; }
  return <section className={styles.bloque} aria-labelledby="admin-usuarios">
    <div className={styles.tituloBloque}><h2 id="admin-usuarios">Usuarios y perfiles</h2></div>
    <p>Busca cuentas por nombre o UUID y revisa su estado y asignaciones cuando la lectura está disponible.</p>
    <div className={styles.filtrosAdmin}>
      <label>Búsqueda por nombre o UUID<input type="search" value={q} maxLength={80} onChange={e => filtrar(() => setQ(e.target.value))} /></label>
      <label>Filtrar por rol<select value={rol} onChange={e => filtrar(() => setRol(e.target.value))}>
        <option value="todos">Todos los roles</option><option value="paciente">Paciente</option><option value="odontologo">Odontólogo</option><option value="superusuario">Superusuario</option><option value="sin_asignacion">Sin asignación</option><option value="asignacion_invalida">Asignación inválida</option>
      </select></label>
      <label>Filtrar por estado de cuenta<select value={estado} onChange={e => filtrar(() => setEstado(e.target.value))}>
        <option value="todos">Todos los estados</option>{Object.entries(ESTADOS_CUENTA).map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
      </select></label>
      <label>Cuentas por página<select value={tamano} onChange={e => filtrar(() => setTamano(Number(e.target.value)))}>{[5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    </div>
    {cargando ? <EstadoAdministrativo estado="carga" /> : error ? <>
      <EstadoAdministrativo estado="error" reintentarTexto="Volver a consultar" onReintentar={() => setReintento(v => v + 1)} /><p role="alert" className={styles.errorAdmin}>{error}</p>
    </> : resultado && <>
      <p ref={resumen} tabIndex={-1} role="status" className={styles.resumenAdmin}>{resultado.total} cuentas · Origen Supabase · Página {resultado.pagina} de {resultado.paginas}. Lectura no transaccional.</p>
      {resultado.usuarios.length === 0 ? <EstadoAdministrativo estado="vacio" /> : <div className={styles.tablaUsuarios} role="region" aria-label="Listado administrativo desplazable" tabIndex={0}>
        <table className={styles.tabla}><caption className="sr-only">Perfiles y asignaciones de la fuente administrativa autorizada</caption>
          <thead><tr><th scope="col">Identidad y perfil</th><th scope="col">Asignaciones</th><th scope="col">Estado de cuenta</th></tr></thead>
          <tbody>{resultado.usuarios.map(u => <tr key={u.id}>
            <td><strong>{u.perfil.nombre || (u.perfil.estado === "ausente" ? "Sin perfil" : "Perfil sin nombre")}</strong><small>{u.id}</small>
              <button type="button" className={styles.enlaceBoton} onClick={() => onSeleccionar(u.id)}>Consultar roles de {u.perfil.nombre || "esta cuenta"}</button></td>
            <td><span className={styles.chipsRoles}>{u.asignacion.roles.length ? u.asignacion.roles.map(rol => <span key={rol}>{rol}</span>) : <span>Sin roles válidos</span>}</span><small>{ESTADOS_ASIGNACION[u.asignacion.estado]}</small></td>
            <td><span className={styles.estadoCuenta} data-estado={u.cuenta}>{ESTADOS_CUENTA[u.cuenta]}</span></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav className={styles.paginacionAdmin} aria-label="Paginación del listado administrativo">
        <button type="button" className={styles.accionEstado} disabled={resultado.pagina <= 1} onClick={() => { enfocar.current = true; setPagina(resultado.pagina - 1); }}>Anterior</button>
        <button type="button" className={styles.accionEstado} disabled={resultado.pagina >= resultado.paginas} onClick={() => { enfocar.current = true; setPagina(resultado.pagina + 1); }}>Siguiente</button>
      </nav>
    </>}
  </section>;
}
