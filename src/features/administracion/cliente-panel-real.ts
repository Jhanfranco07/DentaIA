import { crearTransporteAdministrativo, fallo, type ResultadoCliente } from "./cliente";
import { validarConsultaReal, type PaginaUsuariosReales } from "./usuarios-reales";
import { asignacionRolesValida, type AsignacionRoles } from "./cambios-roles";

import { paginaReal } from "./pagina-usuarios-reales";

export { paginaReal };

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const entero = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

export function crearClientePanelReal(obtenerToken: () => Promise<string | null>, solicitar: typeof fetch = fetch) {
  const enviar = crearTransporteAdministrativo(obtenerToken, solicitar);
  return {
    async listar(entrada: unknown, signal?: AbortSignal): Promise<ResultadoCliente<PaginaUsuariosReales>> {
      const q = validarConsultaReal(entrada);
      if (!q) return fallo(400, "CONSULTA_INVALIDA");
      const r = await enviar("/api/administracion/usuarios/reales?" + new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])), { signal });
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
