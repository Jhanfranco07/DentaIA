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

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("payments").insert(row);
  if (!error) return;
  if (error.code !== "23505") throw error;

  // Un conflicto de evento o sesión solo es una reentrega válida si corresponde
  // a la misma sesión, propietario y datos económicos inmutables.
  const { data: existing, error: readError } = await admin
    .from("payments")
    .select("user_id,stripe_session_id,stripe_event_id,plan,amount_total,currency,status")
    .eq("stripe_session_id", row.stripe_session_id)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing || existing.user_id !== row.user_id || existing.plan !== row.plan ||
      existing.amount_total !== row.amount_total || existing.currency !== row.currency) {
    throw error;
  }
  if (existing.stripe_event_id === row.stripe_event_id) return;

  const { data: eventOwner, error: eventReadError } = await admin.from("payments")
    .select("stripe_session_id")
    .eq("stripe_event_id", row.stripe_event_id)
    .maybeSingle();
  if (eventReadError) throw eventReadError;
  if (eventOwner && eventOwner.stripe_session_id !== row.stripe_session_id) throw error;

  // Conservar el primer evento UNIQUE; solo salir de unpaid. El filtro SQL
  // hace que dos entregas concurrentes no sobrescriban un estado terminal.
  if (existing.status !== "unpaid" || row.status === "unpaid") return;
  const { error: updateError } = await admin.from("payments")
    .update({ status: row.status })
    .eq("stripe_session_id", row.stripe_session_id)
    .eq("status", "unpaid");
  if (updateError) throw updateError;
}

export function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  return savePayment(event, session.payment_status === "paid" ? "paid" : "unpaid");
}

export function handleCheckoutExpired(event: Stripe.Event) {
  return savePayment(event, "expired");
}

export function handleAsyncPaymentSucceeded(event: Stripe.Event) {
  return savePayment(event, "paid");
}
