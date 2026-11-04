import { crearTransporteAdministrativo, fallo, type ResultadoCliente } from "./cliente";
import { validarConsultaReal, type PaginaUsuariosReales, type UsuarioReal } from "./usuarios-reales";
import { asignacionRolesValida, type AsignacionRoles } from "./cambios-roles";

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const entero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const roles = (v: unknown): v is UsuarioReal["asignacion"]["roles"] => Array.isArray(v) && v.length <= 3 && new Set(v).size === v.length
  && v.every(r => ["paciente", "odontologo", "superusuario"].includes(r));

/** Proyección mínima y contrato distinto del proveedor sintético; no colapsa estados. */
export function paginaReal(v: unknown): PaginaUsuariosReales | null {
  if (!objeto(v) || v.origen !== "supabase" || v.consistencia !== "lectura_no_transaccional"
    || !entero(v.total) || !entero(v.pagina) || !entero(v.paginas) || !entero(v.tamano) || ![5, 10, 20].includes(v.tamano)
    || v.paginas !== Math.max(1, Math.ceil(v.total / v.tamano)) || v.pagina < 1 || v.pagina > v.paginas
    || !Array.isArray(v.usuarios) || v.usuarios.length !== Math.min(v.tamano, Math.max(0, v.total - (v.pagina - 1) * v.tamano))) return null;
  const usuarios: UsuarioReal[] = [];
  for (const u of v.usuarios) {
    if (!objeto(u) || !uuid(u.id) || !objeto(u.perfil) || !objeto(u.asignacion)
      || !["habilitada", "suspendida", "sin_confirmar", "anonima", "eliminada", "inconsistente"].includes(String(u.cuenta))
      || !["presente", "ausente"].includes(String(u.perfil.estado))
      || !(u.perfil.nombre === null || (typeof u.perfil.nombre === "string" && u.perfil.nombre.length <= 120))
      || (u.perfil.estado === "ausente" && u.perfil.nombre !== null)
      || !["activa", "suspendida", "ausente", "invalida"].includes(String(u.asignacion.estado)) || !roles(u.asignacion.roles)
      || (["activa", "suspendida"].includes(String(u.asignacion.estado)) ? u.asignacion.roles.length === 0 : u.asignacion.roles.length !== 0)) return null;
    usuarios.push({ id: u.id, cuenta: u.cuenta as UsuarioReal["cuenta"],
      perfil: { estado: u.perfil.estado as "presente" | "ausente", nombre: u.perfil.nombre as string | null },
      asignacion: { estado: u.asignacion.estado as UsuarioReal["asignacion"]["estado"], roles: [...u.asignacion.roles] } });
  }
  if (new Set(usuarios.map(u => u.id.toLowerCase())).size !== usuarios.length) return null;
  return { origen: "supabase", consistencia: "lectura_no_transaccional", total: v.total, pagina: v.pagina, paginas: v.paginas, tamano: v.tamano, usuarios };
}

export function crearClientePanelReal(obtenerToken: () => Promise<string | null>, solicitar: typeof fetch = fetch) {
  const enviar = crearTransporteAdministrativo(obtenerToken, solicitar);
  return {
    async listar(entrada: unknown): Promise<ResultadoCliente<PaginaUsuariosReales>> {
      const q = validarConsultaReal(entrada);
      if (!q) return fallo(400, "CONSULTA_INVALIDA");
      const r = await enviar("/api/administracion/usuarios/reales?" + new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])));
      if (!r.ok) return r;
      const valor = paginaReal(r.valor);
      return valor && valor.tamano === q.tamano && valor.pagina === Math.min(q.pagina, valor.paginas)
        ? { ok: true, valor } : fallo(502, "RESPUESTA_INVALIDA");
    },
  };
}

/** Una consulta o escritura no se anuncia como aplicada por recibir solamente HTTP200. */
export function respuestaRolesPanel(v: unknown, solicitudId: string | null): { revision: number; asignacion: AsignacionRoles | null; resultado: "consultado" | "aplicado" | "sin_cambios" } | null {
  if (!objeto(v) || !entero(v.revision) || v.revision >= 2147483647 || (v.asignacion !== null && !asignacionRolesValida(v.asignacion))
    || v.solicitudId !== solicitudId || !(v.resultado === "consultado" ? v.codigo === "ESTADO_ACTUAL" : v.resultado === "aplicado" ? v.codigo === "CAMBIO_APLICADO" : v.resultado === "sin_cambios" && v.codigo === "SIN_CAMBIOS")
    || !(solicitudId === null ? v.resultado === "consultado" : ["aplicado", "sin_cambios"].includes(String(v.resultado)))) return null;
  return { revision: v.revision, asignacion: v.asignacion as AsignacionRoles | null, resultado: v.resultado as "consultado" | "aplicado" | "sin_cambios" };
}
