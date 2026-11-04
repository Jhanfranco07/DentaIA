import type { RolNegocio } from "../autorizacion/autorizacion";

export type RolAdministrado = Exclude<RolNegocio, "visitante">;
export type UsuarioAdministrativo = {
  id: string;
  etiqueta: string;
  roles: RolAdministrado[];
  origenRoles: "sintetico" | "persistido" | "sin_asignacion";
  estado: "activo" | "suspendido";
};
export type PaginaUsuarios = {
  origen: "sintetico" | "supabase";
  usuarios: UsuarioAdministrativo[];
  total: number;
  pagina: number;
  paginas: number;
  tamano: number;
};
export type PropuestaValidada = {
  modo: "solo_validacion";
  aplicado: false;
  usuarioId: string;
  rol: RolAdministrado;
  mensaje: string;
};
export type ResultadoAdministrativo<T> = { ok: true; valor: T } | {
  ok: false; status: 400 | 403 | 404 | 503; codigo: string; mensaje: string;
};
export type ProveedorAdministrativo = {
  listar: (entrada: unknown) => Promise<ResultadoAdministrativo<PaginaUsuarios>>;
  validarPropuesta: (entrada: unknown, actorId: string) => Promise<ResultadoAdministrativo<PropuestaValidada>>;
};
export type EscenarioAdministrativo = "normal" | "vacio" | "error";
export const ACTOR_ADMINISTRATIVO_DEMO = "00000000-0000-4000-8000-000000000001";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fallo = (status: 400 | 403 | 404 | 503, codigo: string, mensaje: string) => ({ ok: false as const, status, codigo, mensaje });
function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}
export function identificadorAdministrativoValido(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function validarConsultaUsuarios(entrada: unknown) {
  if (!objeto(entrada) || Object.keys(entrada).some(clave => !["q", "rol", "estado", "pagina", "tamano"].includes(clave))) {
    return fallo(400, "CONSULTA_INVALIDA", "La consulta contiene campos no permitidos.");
  }
  const { q = "", rol = "todos", estado = "todos", pagina = 1, tamano = 5 } = entrada;
  if (typeof q !== "string" || q.trim().length > 80
    || typeof rol !== "string" || !["todos", "paciente", "odontologo", "superusuario", "sin_asignacion"].includes(rol)
    || typeof estado !== "string" || !["todos", "activo", "suspendido"].includes(estado)
    || !Number.isInteger(pagina) || Number(pagina) < 1 || Number(pagina) > 1000
    || typeof tamano !== "number" || ![5, 10, 20].includes(tamano)) {
    return fallo(400, "CONSULTA_INVALIDA", "Revisa la búsqueda, los filtros y la paginación.");
  }
  return { ok: true as const, valor: { q: q.trim(), rol, estado, pagina: Number(pagina), tamano } };
}

// Fixtures explícitos sin nombres personales, correos o vínculos a recursos clínicos.
const CUENTAS_SINTETICAS: readonly UsuarioAdministrativo[] = Array.from({ length: 13 }, (_, indice) => ({
  id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
  etiqueta: `Cuenta de prueba ${String(indice + 1).padStart(2, "0")}`,
  roles: indice === 0 ? ["superusuario"] : indice % 4 === 0 ? [] : indice % 3 === 0 ? ["odontologo"] : ["paciente"],
  origenRoles: "sintetico",
  estado: indice % 5 === 4 ? "suspendido" : "activo",
}));

/** Solo memoria: no contiene ni ofrece métodos de escritura, Auth Admin o Supabase. */
export function crearProveedorAdministrativoSimulado(
  opciones: { escenario?: EscenarioAdministrativo; demoraMs?: number } = {},
): ProveedorAdministrativo {
  const { escenario = "normal", demoraMs = 0 } = opciones;
  const esperar = () => new Promise<void>(resolve => setTimeout(resolve, demoraMs));
  return {
    async listar(entrada) {
      const consulta = validarConsultaUsuarios(entrada);
      if (!consulta.ok) return consulta;
      await esperar();
      if (escenario === "error") return fallo(503, "PROVEEDOR_NO_DISPONIBLE", "No se pudo consultar el proveedor simulado. No se consultó Supabase.");
      const { q, rol, estado, pagina: pedida, tamano } = consulta.valor;
      const registros = (escenario === "vacio" ? [] : CUENTAS_SINTETICAS).filter(usuario =>
        (!q || normalizar(usuario.etiqueta + " " + usuario.id).includes(normalizar(q)))
        && (rol === "todos" || (rol === "sin_asignacion" ? usuario.roles.length === 0 : usuario.roles.some(valor => valor === rol)))
        && (estado === "todos" || usuario.estado === estado));
      const paginas = Math.max(1, Math.ceil(registros.length / tamano));
      const pagina = Math.min(pedida, paginas);
      return { ok: true, valor: {
        origen: "sintetico", total: registros.length, paginas, pagina, tamano,
        usuarios: registros.slice((pagina - 1) * tamano, pagina * tamano).map(usuario => ({ ...usuario, roles: [...usuario.roles] })),
      } };
    },
    async validarPropuesta(entrada, actorId) {
      if (!identificadorAdministrativoValido(actorId)) return fallo(403, "ACTOR_INVALIDO", "No se pudo verificar la identidad del operador.");
      if (!objeto(entrada) || Object.keys(entrada).some(clave => !["operacion", "usuarioId", "rol"].includes(clave))
        || entrada.operacion !== "validar_cambio_rol") return fallo(400, "OPERACION_INVALIDA", "Solo se admite validar una propuesta de cambio de rol.");
      if (!identificadorAdministrativoValido(entrada.usuarioId)) return fallo(400, "IDENTIFICADOR_INVALIDO", "El identificador de la cuenta debe ser un UUID válido.");
      if (entrada.usuarioId.toLowerCase() === actorId.toLowerCase()) return fallo(403, "CAMBIO_PROPIO_PROHIBIDO", "No puedes proponer cambios de tus propios privilegios.");
      if (typeof entrada.rol !== "string" || !["paciente", "odontologo", "superusuario"].includes(entrada.rol)) {
        return fallo(400, "ROL_INVALIDO", "El rol no pertenece a los roles de negocio permitidos.");
      }
      if (entrada.rol === "superusuario") return fallo(403, "APROBACION_REQUERIDA", "Las promociones a superusuario requieren un procedimiento independiente de aprobación.");
      await esperar();
      if (escenario === "error") return fallo(503, "PROVEEDOR_NO_DISPONIBLE", "No se pudo validar la propuesta simulada.");
      const cuenta = (escenario === "vacio" ? [] : CUENTAS_SINTETICAS).find(usuario => usuario.id === String(entrada.usuarioId).toLowerCase());
      if (!cuenta) return fallo(404, "CUENTA_NO_ENCONTRADA", "La cuenta no existe en el proveedor simulado.");
      if (cuenta.roles.includes("superusuario")) return fallo(403, "APROBACION_REQUERIDA", "Modificar privilegios de un superusuario requiere revisión independiente.");
      return { ok: true, valor: {
        modo: "solo_validacion", aplicado: false, usuarioId: cuenta.id, rol: entrada.rol as RolAdministrado,
        mensaje: "Propuesta válida en el proveedor simulado. No se aplicó ningún cambio ni se guardó en Supabase. No concede permisos clínicos.",
      } };
    },
  };
}
