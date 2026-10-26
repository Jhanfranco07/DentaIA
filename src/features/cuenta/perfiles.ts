import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";

type Cliente = SupabaseClient<Database>;
export type Perfil = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name">;

async function verificarUsuario(client: Cliente, idEsperado: string) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== idEsperado) throw new Error("La sesión cambió.");
}

export async function leerPerfil(client: Cliente, idEsperado: string): Promise<Perfil | null> {
  await verificarUsuario(client, idEsperado);
  const { data, error } = await client.from("profiles").select("id,full_name").eq("id", idEsperado).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarPerfil(client: Cliente, idEsperado: string, nombre: string, crear: boolean): Promise<Perfil> {
  const limpio = nombre.trim();
  if (limpio.length < 2 || limpio.length > 120) throw new Error("Nombre inválido.");
  await verificarUsuario(client, idEsperado);
  const resultado = crear
    ? await client.from("profiles").insert({ id: idEsperado, full_name: limpio }).select("id,full_name").single()
    : await client.from("profiles").update({ full_name: limpio }).eq("id", idEsperado).select("id,full_name").single();
  // Otra pestaña pudo crear el perfil. Recuperarlo sin sobrescribir sus datos.
  if (crear && resultado.error?.code === "23505") {
    const existente = await leerPerfil(client, idEsperado);
    if (existente) return existente;
  }
  if (resultado.error) throw resultado.error;
  if (!resultado.data) throw new Error("No se pudo guardar el perfil.");
  return resultado.data;
}
