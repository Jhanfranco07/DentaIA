import "server-only";

import { createUserScopedSupabaseClient } from "@/lib/supabase/request.server";
import { effectivePlan, type Plan } from "./catalogo";

/** Server-only adapter for the user's RLS-protected subscription. */
export async function readEffectivePlan(accessToken: string): Promise<Plan> {
  const now = new Date();
  const { data, error } = await createUserScopedSupabaseClient(accessToken)
    .from("premium_subscriptions")
    .select("status,current_period_end")
    .eq("status", "active")
    .gt("current_period_end", now.toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo verificar el plan.", { cause: error });
  return effectivePlan(data, now);
}
