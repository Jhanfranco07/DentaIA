import type { PaginaUsuariosReales, UsuarioReal } from "./usuarios-reales";

export type CasoLectura = { caso: string; http: number; registros: number | null; total: number | null;
  pagina: number | null; paginas: number | null; tamano: number | null; correcto: boolean; camposMinimos: boolean | null; respuestaPrivada: boolean };
export type InformeLectura = { estado: "COHERENTE" | "FALLO" | "BLOQUEADA"; httpInicial: number;
  registrosConsultados: number | null; perfilesPresentes: number | null; perfilesAusentes: number | null;
  coherenciaPaginacion: boolean | null; casos: CasoLectura[]; limiteQA: number; motivo: string | null };
export type SolicitarCasoLectura = (query: URLSearchParams, identidad: "actual" | "ausente" | "invalida") => Promise<Response>;
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const claves = (v: unknown, k: string[]) => objeto(v) && Object.keys(v).length === k.length && Object.keys(v).every(c => k.includes(c));
const entero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const roles = ["paciente", "odontologo", "superusuario"];
const estados = ["habilitada", "suspendida", "sin_confirmar", "anonima", "eliminada", "inconsistente"];
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function paginaMinimaValida(v: unknown): v is PaginaUsuariosReales {
  if (!claves(v, ["origen", "consistencia", "total", "pagina", "paginas", "tamano", "usuarios"]) || !objeto(v)
    || v.origen !== "supabase" || v.consistencia !== "lectura_no_transaccional"
    || !entero(v.total) || !entero(v.pagina) || !entero(v.paginas) || !entero(v.tamano)
    || ![5, 10, 20].includes(v.tamano) || v.pagina < 1 || v.pagina > v.paginas
    || v.paginas !== Math.max(1, Math.ceil(v.total / v.tamano)) || !Array.isArray(v.usuarios)
    || v.usuarios.length !== Math.min(v.tamano, Math.max(0, v.total - (v.pagina - 1) * v.tamano))) return false;
  return new Set(v.usuarios.map(u => objeto(u) ? u.id : null)).size === v.usuarios.length && v.usuarios.every(u => {
    if (!claves(u, ["id", "perfil", "cuenta", "asignacion"]) || !objeto(u) || typeof u.id !== "string" || !uuid.test(u.id)
      || !estados.includes(String(u.cuenta)) || !claves(u.perfil, ["estado", "nombre"]) || !objeto(u.perfil)
      || !claves(u.asignacion, ["estado", "roles"]) || !objeto(u.asignacion)) return false;
    const perfil = u.perfil, a = u.asignacion;
    return (perfil.estado === "ausente" ? perfil.nombre === null : perfil.estado === "presente" && typeof perfil.nombre === "string" && perfil.nombre.length <= 120)
      && ["activa", "suspendida", "ausente", "invalida"].includes(String(a.estado)) && Array.isArray(a.roles)
      && a.roles.every(r => typeof r === "string" && roles.includes(r)) && new Set(a.roles).size === a.roles.length
      && (["ausente", "invalida"].includes(String(a.estado)) ? a.roles.length === 0 : a.roles.length > 0);
  });
}

/** No conserva filas en el informe. El transporte inyectado usa el handler real o fixtures explícitos. */
export async function ejecutarMatrizLectura(solicitar: SolicitarCasoLectura): Promise<InformeLectura> {
  const informe: InformeLectura = { estado: "BLOQUEADA", httpInicial: 0, registrosConsultados: null,
    perfilesPresentes: null, perfilesAusentes: null, coherenciaPaginacion: null, casos: [], limiteQA: 100, motivo: null };
  async function consultar(caso: string, query = new URLSearchParams(), esperado = 200, identidad: "actual" | "ausente" | "invalida" = "actual") {
    const r = await solicitar(query, identidad);
    const privada = /private/.test(r.headers.get("cache-control") ?? "") && /no-store/.test(r.headers.get("cache-control") ?? "")
      && r.headers.get("cdn-cache-control") === "no-store" && /Authorization/i.test(r.headers.get("vary") ?? "");
    const dato: unknown = r.status === 200 ? await r.json().catch(() => null) : null;
    const valida = r.status === 200 ? paginaMinimaValida(dato) : null;
    const pagina = valida ? dato as PaginaUsuariosReales : null;
    const fila: CasoLectura = { caso, http: r.status, registros: pagina?.usuarios.length ?? null, total: pagina?.total ?? null,
      pagina: pagina?.pagina ?? null, paginas: pagina?.paginas ?? null, tamano: pagina?.tamano ?? null,
      camposMinimos: valida, respuestaPrivada: privada, correcto: r.status === esperado && privada && (r.status !== 200 || valida === true) };
    informe.casos.push(fila);
    if (!informe.httpInicial) informe.httpInicial = r.status;
    if (!fila.correcto) throw new Error(r.status === 401 || r.status === 403 ? "SESION_O_PERMISO" : "RESPUESTA_NO_CONFORME");
    return { pagina, fila };
  }
  const q = (v: Record<string, string | number>) => new URLSearchParams(Object.entries(v).map(([k, x]) => [k, String(x)]));
  const mismos = (a: UsuarioReal[], b: UsuarioReal[]) => a.length === b.length && a.every((u, i) => u.id === b[i]?.id);
  try {
    const base = (await consultar("listado_base", q({ pagina: 1, tamano: 20 }))).pagina!;
    informe.registrosConsultados = base.total;
    if (base.total > informe.limiteQA) { informe.motivo = "LIMITE_DE_MUESTRA_QA"; return informe; }
    const todas = [...base.usuarios];
    for (let p = 2; p <= base.paginas; p++) {
      const r = await consultar(`base_pagina_${p}`, q({ pagina: p, tamano: 20 }));
      if (r.pagina!.total !== base.total || r.pagina!.pagina !== p) r.fila.correcto = false;
      todas.push(...r.pagina!.usuarios);
    }
    informe.coherenciaPaginacion = todas.length === base.total && new Set(todas.map(u => u.id)).size === base.total
      && todas.every((u, i) => i === 0 || todas[i - 1].id.localeCompare(u.id) < 0);
    informe.perfilesPresentes = todas.filter(u => u.perfil.estado === "presente").length;
    informe.perfilesAusentes = todas.filter(u => u.perfil.estado === "ausente").length;
    async function comparar(caso: string, parametros: Record<string, string | number>, esperadas: UsuarioReal[]) {
      const r = await consultar(caso, q({ ...parametros, tamano: 20 }));
      r.fila.correcto = r.fila.correcto && r.pagina!.total === esperadas.length && mismos(r.pagina!.usuarios, esperadas.slice(0, 20));
    }
    if (todas.length) {
      await comparar("busqueda_uuid", { q: todas[0].id }, [todas[0]]);
      const conNombre = todas.find(u => u.perfil.nombre?.trim());
      if (conNombre) {
        const texto = Array.from(conNombre.perfil.nombre!.trim()).slice(0, 16).join("");
        await comparar("busqueda_nombre", { q: texto }, todas.filter(u => normalizar(u.id + " " + (u.perfil.nombre ?? "")).includes(normalizar(texto))));
      }
    }
    let sinCoincidencias = "qa-sin-coincidencias-di151";
    while (todas.some(u => normalizar(u.id + " " + (u.perfil.nombre ?? "")).includes(sinCoincidencias))) sinCoincidencias += "x";
    if (sinCoincidencias.length <= 80) await comparar("busqueda_sin_resultados", { q: sinCoincidencias }, []);
    for (const rol of [...roles, "sin_asignacion", "asignacion_invalida"]) {
      await comparar(`rol_${rol}`, { rol }, todas.filter(u => rol === "sin_asignacion" ? u.asignacion.estado === "ausente"
        : rol === "asignacion_invalida" ? u.asignacion.estado === "invalida" : u.asignacion.roles.some(r => r === rol)));
    }
    for (const estado of estados) await comparar(`estado_${estado}`, { estado }, todas.filter(u => u.cuenta === estado));
    if (todas.length) {
      const rol: string = todas[0].asignacion.roles.at(0) ?? (todas[0].asignacion.estado === "invalida" ? "asignacion_invalida" : "sin_asignacion");
      const estado = todas[0].cuenta;
      await comparar("filtros_combinados", { rol, estado }, todas.filter(u => u.cuenta === estado && (rol === "sin_asignacion" ? u.asignacion.estado === "ausente"
        : rol === "asignacion_invalida" ? u.asignacion.estado === "invalida" : u.asignacion.roles.some(r => r === rol))));
    }
    for (const tamano of [5, 10]) {
      const paginas = Math.max(1, Math.ceil(todas.length / tamano));
      for (let p = 1; p <= paginas; p++) {
        const r = await consultar(`paginacion_${tamano}_${p}`, q({ pagina: p, tamano }));
        r.fila.correcto = r.fila.correcto && r.pagina!.total === todas.length && r.pagina!.pagina === p
          && mismos(r.pagina!.usuarios, todas.slice((p - 1) * tamano, p * tamano));
      }
    }
    const ultima = await consultar("pagina_fuera_rango", q({ pagina: 999, tamano: 5 }));
    const numeroUltima = Math.max(1, Math.ceil(todas.length / 5));
    ultima.fila.correcto = ultima.fila.correcto && ultima.pagina!.pagina === numeroUltima
      && mismos(ultima.pagina!.usuarios, todas.slice((numeroUltima - 1) * 5));
    await consultar("query_duplicada", new URLSearchParams("pagina=1&pagina=2"), 400);
    await consultar("rol_no_admitido", q({ rol: "admin" }), 400);
    await consultar("actor_no_admitido", q({ actorId: "no-admitido" }), 400);
    await consultar("sin_sesion", new URLSearchParams(), 401, "ausente");
    await consultar("token_sintetico_invalido", new URLSearchParams(), 401, "invalida");
    informe.estado = informe.coherenciaPaginacion && informe.casos.every(c => c.correcto) ? "COHERENTE" : "FALLO";
  } catch (e) {
    informe.estado = informe.httpInicial === 401 || informe.httpInicial === 403 ? "BLOQUEADA" : "FALLO";
    informe.motivo = e instanceof Error && ["SESION_O_PERMISO", "RESPUESTA_NO_CONFORME"].includes(e.message) ? e.message : "TRANSPORTE_O_SERVICIO_NO_DISPONIBLE";
  }
  return informe;
}
