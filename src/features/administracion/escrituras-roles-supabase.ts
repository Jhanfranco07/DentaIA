import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { ProveedorCambiosRoles, RespuestaRoles } from "./cambios-roles";

/** No reutiliza la credencial/cliente de lectura ni admite Admin API, tablas o SQL libre. */
export function crearEscriturasRolesSupabase(): ProveedorCambiosRoles {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.DENTAIA_SUPABASE_ROLE_WRITE_SECRET;
  if (process.env.DENTAIA_ROLE_WRITES_ENABLED !== "true" || !url || !secret) throw new Error("Escritura no habilitada.");
  const origen = new URL(url);
  if (origen.protocol !== "https:" || origen.username || origen.password || origen.pathname !== "/" || origen.search || origen.hash) throw new Error("Origen no válido.");
  const cliente = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const destino = new URL(input instanceof Request ? input.url : String(input));
      const metodo = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (destino.origin !== origen.origin || destino.pathname !== "/rest/v1/rpc/dentaia_cambiar_roles_v1"
        || destino.search || metodo !== "POST") throw new Error("Transporte no permitido.");
      return fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.any([
        AbortSignal.timeout(10000), ...(init?.signal ? [init.signal] : []),
      ]) });
    } },
  });
  return { async ejecutar(sesion, peticion, solicitudId) {
    const { data, error } = await cliente.rpc("dentaia_cambiar_roles_v1", { p_contexto: sesion, p_peticion: peticion, p_solicitud: solicitudId }).retry(false);
    if (error || !data || typeof data !== "object" || Array.isArray(data)
      || Object.keys(data).sort().join(",") !== "asignacion,codigo,resultado,revision,status"
      || ![200,400,403,404,409,503].includes(data.status) || !/^[A-Z_]{1,60}$/.test(data.codigo)
      || !["consultado","aplicado","sin_cambios","rechazado"].includes(data.resultado)
      || (data.status === 200 ? !["consultado","aplicado","sin_cambios"].includes(data.resultado) : data.resultado !== "rechazado")
      || (data.status === 200 && data.revision === null)
      || (data.revision !== null && (!Number.isInteger(data.revision) || data.revision < 0 || data.revision > 2147483647))) throw new Error("Resultado no confirmado.");
    const a = data.asignacion;
    if (a !== null && (typeof a !== "object" || Array.isArray(a) || Object.keys(a).sort().join(",") !== "estado,roles,version"
      || a.version !== 1 || a.estado !== "activo" || !Array.isArray(a.roles) || !a.roles.length || a.roles.length > 3
      || new Set(a.roles).size !== a.roles.length || !a.roles.every((r: unknown) => typeof r === "string" && ["paciente","odontologo","superusuario"].includes(r)))) throw new Error("Resultado no confirmado.");
    return data as RespuestaRoles;
  } };
}
