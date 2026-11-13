import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { handleAsyncPaymentSucceeded, handleCheckoutCompleted, handleCheckoutExpired } from "@/lib/stripe/handlers";

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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(event);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event);
        break;
      default:
        break; // eventos no soportados: respondemos 200 para que Stripe no reintente
    }
  } catch {
    // 500 => Stripe reintenta el evento más tarde
    return NextResponse.json({ error: "Error al procesar el evento." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}