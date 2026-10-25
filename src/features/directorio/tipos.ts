import type { Database } from "@/lib/supabase/database.types";

export type Dentista = Database["public"]["Tables"]["dentists"]["Row"];