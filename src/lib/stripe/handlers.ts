import type Stripe from "stripe";
import type { PaymentStatus } from "@/types/payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_PREMIUM } from "./plan";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildPaymentRow(event: Stripe.Event, status: PaymentStatus) {
  const session = event.data.object as Stripe.Checkout.Session;
  if (event.livemode) throw new Error("Se rechazó un evento de Stripe Live.");
  if (session.metadata?.plan !== PLAN_PREMIUM.id) return null;
  const userId = session.client_reference_id;
  if (!userId || !UUID.test(userId)) {
    throw new Error("La sesión de Checkout no identifica una cuenta válida.");
  }
  if (session.mode !== "payment" || session.amount_total !== PLAN_PREMIUM.amount
    || session.currency !== PLAN_PREMIUM.currency) {
    throw new Error("Los datos económicos de Checkout no coinciden con la configuración del Sandbox.");
  }

  return {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_event_id: event.id,
    plan: PLAN_PREMIUM.id,
    amount_total: session.amount_total,
    currency: session.currency,
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

  if (existing.status === "paid" || row.status === "unpaid") return;
  const allowedStatuses: PaymentStatus[] = row.status === "paid"
    ? ["unpaid", "failed"]
    : existing.status === "unpaid" && (row.status === "failed" || row.status === "expired")
      ? ["unpaid"]
      : [];
  if (!allowedStatuses.length) return;

  // A verified payment wins over a prior async failure, regardless of arrival order.
  const { error: updateError } = await admin.from("payments")
    .update({ status: row.status })
    .eq("stripe_session_id", row.stripe_session_id)
    .in("status", allowedStatuses);
  if (updateError) throw updateError;
}

export function handleCheckoutCompleted(event: Stripe.Event) {
  if (event.type !== "checkout.session.completed") {
    throw new Error("Tipo de evento Checkout no válido.");
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status === "paid") return savePayment(event, "paid");
  if (session.payment_status === "unpaid" || session.payment_status === "no_payment_required") {
    return savePayment(event, "unpaid");
  }
  throw new Error("Estado de pago Checkout no reconocido.");
}

export function handleCheckoutExpired(event: Stripe.Event) {
  if (event.type !== "checkout.session.expired") {
    throw new Error("Tipo de evento Checkout no válido.");
  }
  return savePayment(event, "expired");
}

export function handleAsyncPaymentSucceeded(event: Stripe.Event) {
  if (event.type !== "checkout.session.async_payment_succeeded") {
    throw new Error("Tipo de evento Checkout no válido.");
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") throw new Error("El pago asíncrono no está confirmado.");
  return savePayment(event, "paid");
}

export function handleAsyncPaymentFailed(event: Stripe.Event) {
  if (event.type !== "checkout.session.async_payment_failed") {
    throw new Error("Tipo de evento Checkout no válido.");
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "unpaid") throw new Error("El estado del fallo de pago no es válido.");
  return savePayment(event, "failed");
}
