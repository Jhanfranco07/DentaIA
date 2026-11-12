import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

    switch (event.type) {
        case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.client_reference_id) break;

      const { error } = await getSupabaseAdmin().from("payments").upsert({
        user_id: session.client_reference_id,
        stripe_session_id: session.id,
        stripe_event_id: event.id,
        plan: session.metadata?.plan ?? "premium-demo",
        amount_total: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        status: session.payment_status === "paid" ? "paid" : "unpaid",
        }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
      if (error) throw error;
      break;
    }

        case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.client_reference_id) break;

      const { error } = await getSupabaseAdmin().from("payments").upsert({
        user_id: session.client_reference_id,
        stripe_session_id: session.id,
        stripe_event_id: event.id,
        plan: session.metadata?.plan ?? "premium-demo",
        amount_total: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
        status: "expired",
      }, { onConflict: "stripe_event_id", ignoreDuplicates: true });
      if (error) throw error;
      break;
    }
    default:
    break;
  }

  return NextResponse.json({ received: true });
}