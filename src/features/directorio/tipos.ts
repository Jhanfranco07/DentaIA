import type { Database } from "@/lib/supabase/database.types";

export type Dentista = Database["public"]["Tables"]["dentists"]["Row"];
export type UbicacionPublica = Pick<
  Database["public"]["Tables"]["dentist_public_locations"]["Row"],
  "id" | "dentist_id" | "practice_name" | "practice_address" | "latitude" | "longitude" | "created_at"
>;
export type DentistaDirectorio = Dentista & { ubicaciones: UbicacionPublica[] };
export type MarcadorConsultorio = UbicacionPublica & { dentista: Pick<Dentista, "id" | "name" | "is_demo"> };
