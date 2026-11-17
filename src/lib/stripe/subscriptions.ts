import "server-only";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const estados = new Set(["trialing", "active", "past_due", "unpaid", "paused", "canceled", "incomplete", "incomplete_expired"]);

export function precioPremiumConfigurado(): string {
  const price = process.env.STRIPE_PREMIUM_PRICE_ID?.trim();
  if (!price || !/^price_[a-zA-Z0-9]+$/.test(price)) throw new Error("Precio recurrente de prueba no configurado.");
  return price;
}

function fechaStripe(unix: number | null | undefined): string | null {
  return typeof unix === "number" && Number.isFinite(unix) && unix > 0 ? new Date(unix * 1000).toISOString() : null;
}

/** Stripe Basil API: period belongs to each subscription item, not the root subscription. */
export function periodoSuscripcion(subscription: Stripe.Subscription, priceId: string) {
  const item = subscription.items.data.find(item => item.price.id === priceId);
  if (!item || subscription.items.data.length !== 1) throw new Error("Suscripción Stripe con precio inesperado.");
  return {
    start: fechaStripe(item.current_period_start),
    end: fechaStripe(item.current_period_end),
  };
}

export async function sincronizarSuscripcion(subscriptionId: string, eventCreated: number, checkoutSessionId?: string) {
  if (!/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) throw new Error("Identificador de suscripción no válido.");
  const stripe = getStripe();
  // Always retrieve the canonical, latest Stripe state. Never trust metadata from a client request.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
  if (subscription.livemode) throw new Error("Stripe Live no está permitido.");
  const userId = subscription.metadata?.dentaia_user_id;
  if (!userId || !UUID.test(userId)) throw new Error("Suscripción sin propietario válido.");
  const priceId = precioPremiumConfigurado();
  const period = periodoSuscripcion(subscription, priceId);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (!customerId.startsWith("cus_") || !estados.has(subscription.status)) throw new Error("Suscripción no reconocida.");
  const eventTime = fechaStripe(eventCreated);
  if (!eventTime) throw new Error("Fecha de evento inválida.");

  const admin = getSupabaseAdmin();
  const row = {
    user_id: userId,
    created_at: fechaStripe(subscription.created) ?? eventTime,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    checkout_session_id: checkoutSessionId ?? null,
    plan: "premium" as const,
    status: subscription.status,
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: fechaStripe(subscription.canceled_at),
    stripe_event_created_at: eventTime,
  };
  const { data: existing, error: lookupError } = await admin.from("premium_subscriptions")
    .select("user_id,stripe_customer_id,stripe_price_id,stripe_event_created_at,checkout_session_id")
    .eq("stripe_subscription_id", subscription.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) {
    const { error } = await admin.from("premium_subscriptions").insert(row);
    if (!error) return;
    if (error.code !== "23505") throw error;
    // A concurrent webhook may have created the same row; retry the guarded update below.
  } else if (existing.user_id !== userId || existing.stripe_customer_id !== customerId || existing.stripe_price_id !== priceId) {
    throw new Error("Conflicto de identidad entre suscripciones Stripe.");
  }

  const { data: newer, error: recheckError } = await admin.from("premium_subscriptions")
    .select("user_id,stripe_customer_id,stripe_price_id,checkout_session_id")
    .eq("stripe_subscription_id", subscription.id).maybeSingle();
  if (recheckError) throw recheckError;
  if (!newer || newer.user_id !== userId || newer.stripe_customer_id !== customerId || newer.stripe_price_id !== priceId) {
    throw new Error("Conflicto de identidad al sincronizar la suscripción.");
  }
  if (checkoutSessionId && newer.checkout_session_id && newer.checkout_session_id !== checkoutSessionId) {
    throw new Error("Sesión de Checkout no coincide con la registrada.");
  }
  // Monotonic event guard: retries and older events never overwrite newer states.
  const { error: updateError } = await admin.from("premium_subscriptions").update({
    ...row,
    checkout_session_id: checkoutSessionId ?? newer.checkout_session_id,
  }).eq("stripe_subscription_id", subscription.id).lte("stripe_event_created_at", eventTime);
  if (updateError) throw updateError;
}

/** Called only from a verified, non-live webhook event. */
export async function procesarEventoSuscripcion(event: Stripe.Event): Promise<boolean> {
  if (event.livemode) throw new Error("Se rechazó un evento Live.");
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || session.metadata?.dentaia_plan !== "premium") return false;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId || session.client_reference_id === null) throw new Error("Checkout sin suscripción.");
    await sincronizarSuscripcion(subscriptionId, event.created, session.id);
    return true;
  }
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    if (subscription.metadata?.dentaia_plan !== "premium") return false;
    await sincronizarSuscripcion(subscription.id, event.created);
    return true;
  }
  return false;
}
