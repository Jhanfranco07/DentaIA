import "server-only";

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await getUserFromRequest(request).catch(() => null);
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    const { data, error } = await getSupabaseAdmin().from("premium_subscriptions")
      .select("stripe_subscription_id,status,cancel_at_period_end,current_period_end")
      .eq("user_id", user.id).in("status", ["active", "trialing", "past_due"])
      .order("current_period_end", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No hay suscripciones cancelables." }, { status: 404 });
    if (data.cancel_at_period_end) return NextResponse.json({ cancel_at_period_end: true });
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(data.stripe_subscription_id);
    if (subscription.livemode || subscription.metadata?.dentaia_user_id !== user.id) {
      return NextResponse.json({ error: "No se pudo verificar el propietario de la suscripción." }, { status: 403 });
    }
    if (!["active", "trialing", "past_due"].includes(subscription.status)) {
      return NextResponse.json({ error: "La suscripción ya no admite cancelación programada." }, { status: 409 });
    }
    await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
    // The verified customer.subscription.updated webhook owns database state.
    return NextResponse.json({ cancel_at_period_end: true, message: "Cancelación solicitada para el final del periodo." });
  } catch {
    console.error("No se pudo solicitar la cancelación Stripe Sandbox.");
    return NextResponse.json({ error: "No se pudo cancelar la suscripción de prueba." }, { status: 503 });
  }
}
