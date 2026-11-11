import type { Database } from "@/lib/supabase/database.types";

export type Dentista = Database["public"]["Tables"]["dentists"]["Row"];
export type UbicacionPublica = Pick<
  Database["public"]["Tables"]["dentist_public_locations"]["Row"],
  "id" | "dentist_id" | "practice_name" | "practice_address" | "latitude" | "longitude" | "created_at"
>;
export type DentistaDirectorio = Dentista & { ubicaciones: UbicacionPublica[] };
export type MarcadorConsultorio = UbicacionPublica & { tipo: "consultorio"; dentista: Pick<Dentista, "id" | "name" | "is_demo"> };
export type DemoLocationPublica = Pick<Database["public"]["Tables"]["directory_demo_locations"]["Row"],
  "id" | "slug" | "name" | "district" | "city" | "country" | "latitude" | "longitude" | "is_demo" | "is_published" | "requests_enabled" | "public_label">;
export type MarcadorDemo = Pick<DemoLocationPublica,
  "id" | "slug" | "name" | "district" | "city" | "country" | "latitude" | "longitude" | "public_label"> & { tipo: "demo"; dentist_id?: string };
export type MarcadorDirectorio = MarcadorConsultorio | MarcadorDemo;
