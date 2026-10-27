
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type ClienteSupabase = SupabaseClient<Database>;

export async function obtenerMisSolicitudes(
  cliente: ClienteSupabase,
  usuarioId: string,
) {
  if (!usuarioId.trim()) {
    throw new Error("Debes iniciar sesión para consultar tus solicitudes.");
  }

  const { data: identidad, error: errorIdentidad } =
    await cliente.auth.getUser();

  if (
    errorIdentidad ||
    !identidad.user ||
    identidad.user.id !== usuarioId
  ) {
    throw new Error("Tu sesión no es válida.");
  }

  const { data, error } = await cliente
    .from("appointment_requests")
    .select("*")
    .eq("user_id", identidad.user.id)
    .eq("is_demo", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}


export async function cancelarSolicitudDemo(
  cliente: ClienteSupabase,
  usuarioId: string,
  solicitudId: string,
): Promise<void> {
  if (!usuarioId.trim() || !solicitudId.trim()) {
    throw new Error("El usuario y la solicitud son obligatorios.");
  }

  const { data: identidad, error: errorIdentidad } =
    await cliente.auth.getUser();

  if (
    errorIdentidad ||
    !identidad.user ||
    identidad.user.id !== usuarioId
  ) {
    throw new Error("Tu sesión no es válida.");
  }

  const { data, error } = await cliente
    .from("appointment_requests")
    .update({ status: "cancelled" })
    .eq("id", solicitudId)
    .eq("user_id", identidad.user.id)
    .eq("is_demo", true)
    .eq("status", "requested")
    .select("id");

  if (error) {
    throw error;
  }

  if (!data || data.length !== 1) {
    throw new Error(
      "La solicitud ya no está disponible para cancelar.",
    );
  }
}
