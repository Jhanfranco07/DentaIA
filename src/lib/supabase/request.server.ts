import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const ACCESS_TOKEN = /^[A-Za-z0-9._~+/-]+=*$/;

function isPublishableKey(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon";
  } catch {
    return false;
  }
}

/** Forwards the user's token so Supabase can enforce JWT validity and RLS; never uses an admin key. */
export function createUserScopedSupabaseClient(accessToken: string): SupabaseClient<Database> {
  if (!ACCESS_TOKEN.test(accessToken) || accessToken.length > 8192) {
    throw new Error("La sesión de Supabase no es válida.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !isPublishableKey(key)) throw new Error("Configuración de Supabase no disponible.");

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input, init) => fetch(input, {
        ...init,
        cache: "no-store",
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)])
          : AbortSignal.timeout(8000),
      }),
    },
  });
}
