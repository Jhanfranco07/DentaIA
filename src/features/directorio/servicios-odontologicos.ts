import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type TablaServicios = Database["public"]["Tables"]["dentist_services"];
export type ServicioOdontologico = TablaServicios["Row"];

export interface FormularioServicio {
  nombre: string;
  descripcion: string;
  duracion: string;
  precio: string;
  moneda: string;
  publicado: boolean;
}

export function datosServicio(formulario: FormularioServicio) {
  const name = formulario.nombre.trim();
  const description = formulario.descripcion.trim() || null;
  const duracion = formulario.duracion.trim();
  const duration_minutes = duracion ? Number(duracion) : null;
  const precio = formulario.precio.trim().replace(",", ".");
  const price_amount = precio ? Number(precio) : null;
  const currency_code = formulario.moneda.trim().toUpperCase();

  if (!name || name.length > 160) throw new Error("Escribe un nombre de hasta 160 caracteres.");
  if (description && description.length > 2000) throw new Error("La descripción admite hasta 2000 caracteres.");
  if (duration_minutes !== null && (!/^\d+$/.test(duracion) || duration_minutes < 5 || duration_minutes > 480)) {
    throw new Error("La duración debe ser un número entero entre 5 y 480 minutos.");
  }
  if (price_amount !== null && (!/^\d+(\.\d{1,2})?$/.test(precio) || price_amount > 99_999_999.99)) {
    throw new Error("Ingresa un precio válido, con un máximo de dos decimales.");
  }
  if (!/^[A-Z]{3}$/.test(currency_code)) throw new Error("Escribe un código de moneda de tres letras, como PEN.");

  return { name, description, duration_minutes, price_amount, currency_code, is_active: formulario.publicado };
}

export function consultarServicios(
  client: SupabaseClient<Database>,
  dentistId: string,
  soloPublicados: boolean,
  signal: AbortSignal,
) {
  const consulta = client.from("dentist_services").select("*").eq("dentist_id", dentistId);
  return (soloPublicados ? consulta.eq("is_active", true) : consulta)
    .order("sort_order").order("name").abortSignal(signal);
}

export function guardarServicio(
  client: SupabaseClient<Database>,
  dentistId: string,
  datos: ReturnType<typeof datosServicio>,
  anterior: ServicioOdontologico | null,
) {
  const tabla = client.from("dentist_services");
  if (!anterior) return tabla.insert({ ...datos, dentist_id: dentistId }).select().single();

  const siguienteRevision = new Date(Math.max(Date.now(), Date.parse(anterior.updated_at) + 1));
  return tabla.update({ ...datos, updated_at: siguienteRevision.toISOString() })
    .eq("dentist_id", dentistId).eq("id", anterior.id).eq("updated_at", anterior.updated_at)
    .select().maybeSingle();
}
