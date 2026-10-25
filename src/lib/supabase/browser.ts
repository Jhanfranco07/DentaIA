import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

/** Client-only sessions. Private data is authorized by Supabase RLS, not by UI. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error("El cliente de Supabase solo se utiliza desde el navegador.");
  }
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Falta configurar .env.local. Copia .env.example y reinicia npm run dev.");
  }
  client = createClient<Database>(url, key);
  return client;
}
