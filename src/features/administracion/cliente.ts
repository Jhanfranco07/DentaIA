import { identificadorAdministrativoValido, validarConsultaUsuarios } from "./servicios";
import type { PaginaUsuarios, PropuestaValidada, UsuarioAdministrativo } from "./servicios";

export type ErrorClienteAdministrativo = { ok: false; status: number; codigo: string; mensaje: string };
export type ResultadoCliente<T> = { ok: true; valor: T } | ErrorClienteAdministrativo;
export type ClientePanelAdministrativo = {
  listar: (entrada: unknown) => Promise<ResultadoCliente<PaginaUsuarios>>;
  validarPropuesta: (entrada: unknown) => Promise<ResultadoCliente<PropuestaValidada>>;
};

export const esDenegacionDeAcceso = (error: ErrorClienteAdministrativo) => error.status === 401
  || (error.status === 403 && ["ERROR_API", "ROL_INSUFICIENTE", "CUENTA_NO_HABILITADA", "MFA_AAL2_PENDIENTE"].includes(error.codigo));

export function fallo(status: number, codigo: string): ErrorClienteAdministrativo {
  const mensajes: Record<string, string> = {
    CAMBIO_PROPIO_PROHIBIDO: "No puedes proponer cambios de tus propios privilegios.",
    APROBACION_REQUERIDA: "Este cambio requiere aprobación independiente. No se aplicó ninguna modificación.",
    SESION_INVALIDA: "Tu sesión venció o no pudo validarse. Inicia sesión nuevamente.",
    IDENTIDAD_NO_DISPONIBLE: "No pudimos validar tu identidad con el servicio de autenticación. Inténtalo más tarde.",
    CUENTA_NO_HABILITADA: "La cuenta no está habilitada para acceder a la administración.",
    ROL_INSUFICIENTE: "Esta cuenta no tiene el rol superusuario activo.",
    MFA_AAL2_PENDIENTE: "Completa la verificación MFA para continuar con la administración.",
    LECTURA_ADMINISTRATIVA_NO_DISPONIBLE: "La consulta real de usuarios no está habilitada en este entorno.",
    RESPUESTA_AUTH_INVALIDA: "Auth devolvió una respuesta administrativa incompatible. No se muestran datos parciales.",
    RESPUESTA_PERFILES_INVALIDA: "La respuesta de perfiles no pudo validarse. No se muestran datos parciales.",
    LECTURA_INESTABLE: "La lista cambió durante la consulta. Vuelve a consultar para obtener un resultado completo.",
    LIMITE_LECTURA_REAL: "La consulta superó el límite seguro de lectura. Ajusta los filtros o solicita soporte.",
    LECTURA_NO_DISPONIBLE: "La fuente administrativa no está disponible en este momento.",
    LECTURA_REAL_NO_DISPONIBLE: "La fuente administrativa no está disponible en este momento.",
    CONEXION_NO_DISPONIBLE: "No se pudo conectar con la API administrativa. Inténtalo nuevamente.",
  };
  return { ok: false, status, codigo, mensaje: mensajes[codigo] ?? (
    status === 401 ? "Inicia sesión de nuevo en Mi cuenta para consultar la API administrativa."
      : status === 403 ? "Acceso denegado. Se requiere superusuario activo, sesión AAL2 y factor verificado; la decisión corresponde al servidor."
      : status === 400 ? "Revisa los filtros o los datos de la propuesta. No se aplicaron cambios."
      : status === 404 ? "El recurso solicitado no está disponible."
      : status === 413 ? "La propuesta supera el tamaño permitido."
      : status === 429 ? "Demasiadas solicitudes. Espera antes de volver a intentarlo."
      : "No pudimos completar la consulta administrativa. Vuelve a intentarlo; no se confirmaron cambios."
  ) };
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const entero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const rol = (v: unknown) => typeof v === "string" && ["paciente", "odontologo", "superusuario"].includes(v);

function paginaValida(v: unknown): v is PaginaUsuarios {
  if (!objeto(v) || !["sintetico", "supabase"].includes(String(v.origen)) || !entero(v.total)
    || !entero(v.pagina) || !entero(v.paginas) || !entero(v.tamano) || ![5, 10, 20].includes(v.tamano)
    || v.paginas !== Math.max(1, Math.ceil(v.total / v.tamano)) || v.pagina < 1 || v.pagina > v.paginas
    || !Array.isArray(v.usuarios) || v.usuarios.length !== Math.min(v.tamano, Math.max(0, v.total - (v.pagina - 1) * v.tamano))) return false;
  return new Set(v.usuarios.map(u => objeto(u) ? u.id : null)).size === v.usuarios.length && v.usuarios.every(u =>
    objeto(u) && identificadorAdministrativoValido(u.id) && typeof u.etiqueta === "string" && u.etiqueta.trim().length > 0 && u.etiqueta.length <= 120
    && Array.isArray(u.roles) && u.roles.length <= 3 && u.roles.every(rol) && new Set(u.roles).size === u.roles.length
    && ["activo", "suspendido"].includes(String(u.estado))
    && (v.origen === "sintetico" ? u.origenRoles === "sintetico"
      : (u.origenRoles === "persistido" || (u.origenRoles === "sin_asignacion" && u.roles.length === 0))));
}

/** Transporte compartido; los adaptadores fijan sus rutas, nunca la entrada del usuario. */
export function crearTransporteAdministrativo(
  obtenerToken: () => Promise<string | null>,
  solicitar: typeof fetch = fetch,
) {
  async function enviar(ruta: string, init: RequestInit = {}): Promise<ResultadoCliente<unknown>> {
    try {
      // Leer la sesión en cada petición permite utilizar el token renovado, sin capturarlo en React.
      const token = await obtenerToken();
      if (!token || /\s/.test(token)) return fallo(401, "SESION_REQUERIDA");
      const respuesta = await solicitar(ruta, {
        ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` },
        credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(10000),
      });
      if (!respuesta.ok) {
        // Aceptar únicamente códigos públicos conocidos; ignorar cuerpo, correo y detalles del proveedor.
        let codigo = "ERROR_API";
        try {
          const cuerpo: unknown = await respuesta.json();
          const permitidos = ["CAMBIO_PROPIO_PROHIBIDO", "APROBACION_REQUERIDA", "SESION_INVALIDA", "IDENTIDAD_NO_DISPONIBLE",
            "CUENTA_NO_HABILITADA", "ROL_INSUFICIENTE", "MFA_AAL2_PENDIENTE", "LECTURA_ADMINISTRATIVA_NO_DISPONIBLE",
            "RESPUESTA_AUTH_INVALIDA", "RESPUESTA_PERFILES_INVALIDA", "LECTURA_INESTABLE", "LIMITE_LECTURA_REAL", "LECTURA_NO_DISPONIBLE", "LECTURA_REAL_NO_DISPONIBLE"];
          if (objeto(cuerpo) && permitidos.includes(String(cuerpo.codigo))) codigo = String(cuerpo.codigo);
        } catch { /* La respuesta no es JSON; conservar un mensaje seguro por estado. */ }
        return fallo(respuesta.status, codigo);
      }
      if (!respuesta.headers.get("content-type")?.toLowerCase().includes("application/json")) return fallo(502, "RESPUESTA_INVALIDA");
      return { ok: true, valor: await respuesta.json() };
    } catch { return fallo(503, "CONEXION_NO_DISPONIBLE"); }
  }
  return enviar;
}

/** Contrato sintético de DI-151 conservado para sus pruebas y vistas identificadas. */
export function crearClienteAdministrativo(obtenerToken: () => Promise<string | null>, solicitar: typeof fetch = fetch) {
  const enviar = crearTransporteAdministrativo(obtenerToken, solicitar);
  return {
    async comprobarAcceso(): Promise<ResultadoCliente<{ autorizado: true }>> {
      const r = await enviar("/api/administracion/acceso");
      if (!r.ok) return r;
      return objeto(r.valor) && r.valor.autorizado === true ? { ok: true, valor: { autorizado: true } } : fallo(502, "RESPUESTA_INVALIDA");
    },
    async listar(entrada: unknown): Promise<ResultadoCliente<PaginaUsuarios>> {
      const consulta = validarConsultaUsuarios(entrada);
      if (!consulta.ok) return fallo(400, consulta.codigo);
      const parametros = new URLSearchParams(Object.entries(consulta.valor).map(([k, v]) => [k, String(v)]));
      const r = await enviar("/api/administracion/usuarios?" + parametros);
      if (!r.ok) return r;
      if (!paginaValida(r.valor)) return fallo(502, "RESPUESTA_INVALIDA");
      const { origen, total, pagina, paginas, tamano } = r.valor;
      const usuarios = r.valor.usuarios.map(({ id, etiqueta, roles, origenRoles, estado }): UsuarioAdministrativo => ({ id, etiqueta, roles: [...roles], origenRoles, estado }));
      return { ok: true, valor: { origen, total, pagina, paginas, tamano, usuarios } };
    },
    async validarPropuesta(entrada: unknown): Promise<ResultadoCliente<PropuestaValidada>> {
      if (!objeto(entrada) || Object.keys(entrada).length !== 3 || entrada.operacion !== "validar_cambio_rol"
        || !identificadorAdministrativoValido(entrada.usuarioId) || !rol(entrada.rol)) return fallo(400, "PROPUESTA_INVALIDA");
      const r = await enviar("/api/administracion/roles/validar", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operacion: entrada.operacion, usuarioId: entrada.usuarioId, rol: entrada.rol }) });
      if (!r.ok) return r;
      const v = r.valor;
      if (!objeto(v) || v.modo !== "solo_validacion" || v.aplicado !== false || v.usuarioId !== entrada.usuarioId || v.rol !== entrada.rol) return fallo(502, "RESPUESTA_INVALIDA");
      return { ok: true, valor: { modo: "solo_validacion", aplicado: false, usuarioId: entrada.usuarioId, rol: entrada.rol as PropuestaValidada["rol"],
        mensaje: "Propuesta validada por la API. No se aplicó ningún cambio ni se guardaron roles. No concede permisos clínicos." } };
    },
  };
}
