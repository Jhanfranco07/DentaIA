import type { RolAdministrado, ResultadoAdministrativo } from "./servicios";

/** DTO de lectura: no concede permisos ni sustituye la autorización de DI-150. */
export type EstadoCuentaReal = "habilitada" | "suspendida" | "sin_confirmar" | "anonima" | "eliminada" | "inconsistente";
export type AsignacionReal = {
  estado: "activa" | "suspendida" | "ausente" | "invalida";
  roles: RolAdministrado[];
};
export type UsuarioReal = {
  id: string;
  perfil: { estado: "presente" | "ausente"; nombre: string | null };
  cuenta: EstadoCuentaReal;
  asignacion: AsignacionReal;
};
export type PaginaUsuariosReales = {
  origen: "supabase";
  consistencia: "lectura_no_transaccional";
  usuarios: UsuarioReal[];
  total: number;
  pagina: number;
  paginas: number;
  tamano: number;
};

/** Puerto de lectura. No expone SDK Admin, consultas arbitrarias ni escrituras. */
export type LecturasUsuariosReales = {
  listarCuentas: (pagina: number, tamano: number) => Promise<{ usuarios: unknown[] }>;
  consultarPerfiles: (ids: readonly string[]) => Promise<unknown[]>;
};
export type ProveedorUsuariosReales = {
  listar: (entrada: unknown) => Promise<ResultadoAdministrativo<PaginaUsuariosReales>>;
};

const ROLES = ["paciente", "odontologo", "superusuario"] as const;
const ESTADOS = ["habilitada", "suspendida", "sin_confirmar", "anonima", "eliminada", "inconsistente"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fallo = (codigo: string) => ({ ok: false as const, status: 503 as const, codigo,
  mensaje: "No se pudo completar la lectura administrativa real. No se muestran datos parciales ni simulados." });

export function validarConsultaReal(entrada: unknown) {
  if (!objeto(entrada) || Object.keys(entrada).some(k => !["q", "rol", "estado", "pagina", "tamano"].includes(k))) return null;
  const { q = "", rol = "todos", estado = "todos", pagina = 1, tamano = 5 } = entrada;
  if (typeof q !== "string" || q.trim().length > 80
    || typeof rol !== "string" || !["todos", ...ROLES, "sin_asignacion", "asignacion_invalida"].includes(rol)
    || typeof estado !== "string" || !["todos", ...ESTADOS].includes(estado)
    || typeof pagina !== "number" || !Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000
    || typeof tamano !== "number" || ![5, 10, 20].includes(tamano)) return null;
  return { q: q.trim(), rol, estado, pagina, tamano };
}

/** Lee solo app_metadata.dentaia recibido por el puerto del servidor, nunca user_metadata. */
function leerAsignacion(metadata: unknown): AsignacionReal {
  if (!objeto(metadata)) return { estado: "invalida", roles: [] };
  if (!("dentaia" in metadata)) return { estado: "ausente", roles: [] };
  const a = metadata.dentaia;
  if (!objeto(a) || a.version !== 1 || typeof a.estado !== "string" || !["activo", "suspendido"].includes(a.estado)
    || !Array.isArray(a.roles) || a.roles.length === 0 || a.roles.length > ROLES.length
    || !a.roles.every(r => typeof r === "string" && (ROLES as readonly string[]).includes(r))
    || new Set(a.roles).size !== a.roles.length) return { estado: "invalida", roles: [] };
  return { estado: a.estado === "activo" ? "activa" : "suspendida", roles: [...a.roles] as RolAdministrado[] };
}

function estadoCuenta(u: Record<string, unknown>, ahora: number): EstadoCuentaReal {
  if (u.deleted_at != null && u.deleted_at !== "") return typeof u.deleted_at === "string" && Number.isFinite(Date.parse(u.deleted_at)) ? "eliminada" : "inconsistente";
  if (u.aud !== "authenticated" || typeof u.is_anonymous !== "boolean") return "inconsistente";
  if (u.is_anonymous) return "anonima";
  if (u.banned_until != null && u.banned_until !== "") {
    const hasta = typeof u.banned_until === "string" ? Date.parse(u.banned_until) : NaN;
    if (!Number.isFinite(hasta)) return "inconsistente";
    if (hasta > ahora) return "suspendida";
  }
  if (u.confirmed_at == null || u.confirmed_at === "") return "sin_confirmar";
  return typeof u.confirmed_at === "string" && Number.isFinite(Date.parse(u.confirmed_at)) ? "habilitada" : "inconsistente";
}

/**
 * Escaneo acotado para filtros globales correctos en una demo pequeña. No promete
 * snapshot de Auth/PostgreSQL. Falla cerrado al exceder el límite o detectar carreras.
 * Nunca reutilizar este resultado como contexto de una escritura.
 */
export function crearProveedorUsuariosReales(
  crearLecturas: () => LecturasUsuariosReales,
  ahora: () => number = Date.now,
): ProveedorUsuariosReales {
  return {
    async listar(entrada) {
      const consulta = validarConsultaReal(entrada);
      if (!consulta) return { ok: false, status: 400, codigo: "CONSULTA_INVALIDA", mensaje: "Revisa los filtros y la paginación de usuarios reales." };
      try {
        // Instancia por petición, solo después de validar y dentro del guard del endpoint.
        const lecturas = crearLecturas();
        const cuentas = new Map<string, Record<string, unknown>>();
        const lote = 100;
        const maximo = 2000;
        let completa = false;
        for (let pagina = 1; pagina <= maximo / lote + 1; pagina++) {
          const respuesta = await lecturas.listarCuentas(pagina, lote);
          if (!Array.isArray(respuesta.usuarios) || respuesta.usuarios.length > lote) return fallo("RESPUESTA_AUTH_INVALIDA");
          for (const u of respuesta.usuarios) {
            if (!objeto(u) || typeof u.id !== "string" || !UUID.test(u.id)) return fallo("RESPUESTA_AUTH_INVALIDA");
            const id = u.id.toLowerCase();
            if (cuentas.has(id)) return fallo("LECTURA_INESTABLE");
            cuentas.set(id, u);
          }
          if (cuentas.size > maximo) return fallo("LIMITE_LECTURA_REAL");
          if (respuesta.usuarios.length < lote) { completa = true; break; }
        }
        if (!completa) return fallo("LIMITE_LECTURA_REAL");

        const perfiles = new Map<string, string>();
        const ids = [...cuentas.keys()];
        for (let i = 0; i < ids.length; i += lote) {
          const solicitados = ids.slice(i, i + lote);
          const recibidos = await lecturas.consultarPerfiles(solicitados);
          if (!Array.isArray(recibidos) || recibidos.length > solicitados.length) return fallo("RESPUESTA_PERFILES_INVALIDA");
          for (const p of recibidos) {
            if (!objeto(p) || typeof p.id !== "string" || !solicitados.includes(p.id.toLowerCase())
              || perfiles.has(p.id.toLowerCase()) || typeof p.full_name !== "string" || p.full_name.length > 120) return fallo("RESPUESTA_PERFILES_INVALIDA");
            perfiles.set(p.id.toLowerCase(), p.full_name);
          }
        }
        const instante = ahora();
        if (!Number.isFinite(instante)) return fallo("LECTURA_NO_DISPONIBLE");
        const registros: UsuarioReal[] = [...cuentas].map(([id, u]) => ({
          id,
          perfil: { estado: perfiles.has(id) ? "presente" : "ausente", nombre: perfiles.get(id) ?? null },
          cuenta: estadoCuenta(u, instante),
          asignacion: leerAsignacion(u.app_metadata),
        }));
        const { q, rol, estado, tamano } = consulta;
        const filtrados = registros.filter(u => (!q || normalizar(u.id + " " + (u.perfil.nombre ?? "")).includes(normalizar(q)))
          && (estado === "todos" || u.cuenta === estado)
          && (rol === "todos" || (rol === "sin_asignacion" ? u.asignacion.estado === "ausente"
            : rol === "asignacion_invalida" ? u.asignacion.estado === "invalida" : u.asignacion.roles.some(r => r === rol))))
          .sort((a, b) => a.id.localeCompare(b.id));
        const paginas = Math.max(1, Math.ceil(filtrados.length / tamano));
        const pagina = Math.min(consulta.pagina, paginas);
        return { ok: true, valor: {
          origen: "supabase", consistencia: "lectura_no_transaccional", total: filtrados.length,
          pagina, paginas, tamano, usuarios: filtrados.slice((pagina - 1) * tamano, pagina * tamano),
        } };
      } catch { return fallo("LECTURA_REAL_NO_DISPONIBLE"); }
    },
  };
}
