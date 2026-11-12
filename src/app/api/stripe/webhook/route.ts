import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import type Stripe from "stripe";

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
    case "checkout.session.completed":
      console.log("Checkout completado:", event.id);
      break;
  }

  return NextResponse.json({ received: true });
}