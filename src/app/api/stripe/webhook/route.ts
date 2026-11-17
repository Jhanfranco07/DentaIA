import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { procesarEventoSuscripcion } from "@/lib/stripe/subscriptions";
import { suscripcionesSandboxHabilitadas } from "@/lib/stripe/subscription-runtime";
import {
  handleAsyncPaymentFailed,
  handleAsyncPaymentSucceeded,
  handleCheckoutCompleted,
  handleCheckoutExpired,
} from "@/lib/stripe/handlers";

export const runtime = "nodejs";

const response = (status: number, body: Record<string, boolean | string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature) return response(400, { error: "Falta la firma de Stripe." });
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET no está configurada.");
    return response(503, { error: "El webhook no está disponible." });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    console.error("La configuración de Stripe Sandbox no está disponible.");
    return response(503, { error: "El webhook no está disponible." });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return response(400, { error: "No se pudo leer el evento de Stripe." });
  }
  if (Buffer.byteLength(body, "utf8") > 1_048_576) {
    return response(413, { error: "El evento de Stripe supera el tamaño permitido." });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return response(400, { error: "Firma inválida." });
  }
  if (event.livemode) {
    console.error("Se rechazó un evento de Stripe Live en el endpoint Sandbox.");
    return response(400, { error: "Este endpoint solo acepta eventos Sandbox." });
  }

  try {
    if (suscripcionesSandboxHabilitadas(process.env) && await procesarEventoSuscripcion(event)) return response(200, { received: true });
    if (event.type.startsWith("customer.subscription.") || (event.type === "checkout.session.completed" && (event.data.object as Stripe.Checkout.Session).mode === "subscription")) {
      return response(200, { received: true }); // Never interpret recurring Checkout as a one-time payment.
    }
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(event);
        break;
      case "checkout.session.async_payment_failed":
        await handleAsyncPaymentFailed(event);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event);
        break;
      default:
        break; // eventos no soportados: respondemos 200 para que Stripe no reintente
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "unknown";
    console.error("Error al procesar el evento Stripe Sandbox.", code);
    return response(500, { error: "Error al procesar el evento." });
  }

  return response(200, { received: true });
}