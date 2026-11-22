
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

type ClienteSupabase = SupabaseClient<Database>;
type Solicitud = Tables<"appointment_requests"> & { dentists: Pick<Tables<"dentists">, "name"> | null };
export type FiltroEstado = "todas" | "requested" | "cancelled";
export type PaginaSolicitudes = {
  items: Solicitud[]; total: number; pagina: number; tamano: number;
  totalSolicitudes: number; solicitadas: number; canceladas: number;
};

export async function obtenerMisSolicitudesPaginadas(
  cliente: ClienteSupabase, consulta: { texto: string; estado: FiltroEstado; pagina: number; tamano: number },
  signal: AbortSignal,
): Promise<PaginaSolicitudes> {
  const { data, error } = await cliente.rpc("dentaia_buscar_solicitudes", {
    p_query: consulta.texto, p_status: consulta.estado, p_page: consulta.pagina, p_size: consulta.tamano,
  }).abortSignal(AbortSignal.any([signal, AbortSignal.timeout(8000)])).retry(false);
  if (error || !data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
    throw new Error("No se pudieron cargar tus solicitudes.");
  }
  return data as unknown as PaginaSolicitudes;
}

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
    .select("*, dentists(name)")
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
