import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import type { LecturasUsuariosReales } from "./usuarios-reales";

function habilitacionLecturasAdministrativas(): boolean {
  const local = process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.VERCEL_ENV;
  const preview = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "develop" && process.env.DENTAIA_ADMIN_PREVIEW_ENABLED === "true";
  return process.env.DENTAIA_ADMIN_READS_ENABLED === "true" && (local || preview);
}

/** No importar desde React. Activación explícita del propietario, nunca desde una petición. */
export function crearLecturasSupabase(): LecturasUsuariosReales {
  const habilitado = habilitacionLecturasAdministrativas();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.DENTAIA_SUPABASE_ADMIN_READ_SECRET;
  if (!habilitado || !url || !secret || !url.startsWith("https://")) {
    throw new Error("Lectura administrativa no configurada.");
  }
  const origen = new URL(url);
  if (origen.username || origen.password || origen.search || origen.hash || origen.pathname !== "/") {
    throw new Error("Origen administrativo no válido.");
  }
  const plazo = AbortSignal.timeout(20000);
  // La credencial tiene privilegios amplios en Supabase. El puerto expuesto aquí NO los tiene.
  const cliente = createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      // Defensa adicional: este cliente no debe emitir ninguna mutación ni seguir redirects.
      const destino = new URL(input instanceof Request ? input.url : String(input));
      if ((init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "GET"
        || destino.origin !== origen.origin || !["/auth/v1/admin/users", "/rest/v1/profiles"].includes(destino.pathname)) {
        throw new Error("Solo lecturas administrativas permitidas.");
      }
      return fetch(input, { ...init, cache: "no-store", redirect: "error",
        signal: AbortSignal.any([plazo, AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]) });
    } },
  });
  return Object.freeze({
    async listarCuentas(pagina: number, tamano: number) {
      if (!Number.isSafeInteger(pagina) || pagina < 1 || !Number.isSafeInteger(tamano) || tamano < 1 || tamano > 100) {
        throw new Error("Paginación Auth no válida.");
      }
      const { data, error } = await cliente.auth.admin.listUsers({ page: pagina, perPage: tamano });
      if (error) throw new Error("Lectura Auth no disponible.");
      // Proyección temprana: eliminar emails, teléfonos, identidades y factores antes del dominio.
      return { usuarios: data.users.map(u => ({ id: u.id, aud: u.aud, is_anonymous: u.is_anonymous,
        confirmed_at: u.confirmed_at, banned_until: u.banned_until, deleted_at: u.deleted_at,
        app_metadata: Object.hasOwn(u.app_metadata ?? {}, "dentaia") ? { dentaia: u.app_metadata.dentaia } : {} })) };
    },
    async consultarPerfiles(ids: readonly string[]) {
      if (!ids.length) return [];
      if (ids.length > 100 || new Set(ids).size !== ids.length
        || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw new Error("Identificadores no válidos.");
      const { data, count, error } = await cliente.from("profiles").select("id,full_name", { count: "exact" })
        .in("id", [...ids]).order("id").range(0, ids.length - 1);
      if (error || !data || count !== data.length) throw new Error("Lectura de perfiles no disponible o incompleta.");
      return data.map(p => ({ id: p.id, full_name: p.full_name }));
    },
  });
}
