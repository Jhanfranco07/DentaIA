import "server-only";

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";
import { getStripe } from "@/lib/stripe/server";
import { precioPremiumConfigurado } from "@/lib/stripe/subscriptions";
import { siteUrl } from "@/lib/stripe/urls";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const user = await getUserFromRequest(req).catch(() => null);
  if (!user) return fail(401, "Inicia sesión para contratar Premium.");
  try {
    const { data: subscriptions, error } = await getSupabaseAdmin().from("premium_subscriptions")
      .select("stripe_subscription_id,status").eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due", "unpaid", "incomplete"])
      .limit(10);
    if (error) throw error;
    if (subscriptions?.length) return fail(409, "Ya tienes una suscripción en curso. Consulta el estado antes de contratar otra.");
    const price = precioPremiumConfigurado();
    const stripe = getStripe();
    const base = siteUrl();
    // Never accept a price or user ID from the browser. Stripe validates the recurring Price.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      subscription_data: { metadata: { dentaia_user_id: user.id, dentaia_plan: "premium" } },
      metadata: { dentaia_plan: "premium" },
      success_url: `${base}/premium/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/premium/cancelado`,
    });
    if (!session.url) throw new Error("Stripe no devolvió una URL.");
    return NextResponse.json({ id: session.id, url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("No se pudo iniciar la suscripción Stripe Sandbox.");
    return fail(503, "La suscripción de prueba no está disponible. Revisa la configuración de Stripe.");
  }
}
