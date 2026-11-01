import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Instancia aislada por petición, con clave publicable y sin persistencia ni SDK Admin. */
export function crearClienteIdentidadServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configuración de identidad no disponible.");
  const cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      cache: "no-store",
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)])
        : AbortSignal.timeout(8000),
    }) },
  });
  // Exponer solo la operación necesaria, sin consultas SQL, Storage o métodos administrativos.
  return { auth: { getUser: (token?: string) => cliente.auth.getUser(token) } };
}
