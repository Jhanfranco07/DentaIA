import type Stripe from "stripe";
import type { PaymentStatus } from "@/types/payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function buildPaymentRow(event: Stripe.Event, status: PaymentStatus) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (!session.client_reference_id) return null;

  return {
    user_id: session.client_reference_id,
    stripe_session_id: session.id,
    stripe_event_id: event.id,
    plan: session.metadata?.plan ?? "premium-demo",
    amount_total: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    status,
  };
}

async function savePayment(event: Stripe.Event, status: PaymentStatus) {
  const row = buildPaymentRow(event, status);
  if (!row) return;

  const { error } = await getSupabaseAdmin()
    .from("payments")
    .upsert(row, { onConflict: "stripe_event_id", ignoreDuplicates: true });
  if (error) throw error;
}

export function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  return savePayment(event, session.payment_status === "paid" ? "paid" : "unpaid");
}

export function handleCheckoutExpired(event: Stripe.Event) {
  return savePayment(event, "expired");
}