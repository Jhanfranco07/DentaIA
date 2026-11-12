import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

  const event = getStripe().webhooks.constructEvent(body, signature, secret);

  return NextResponse.json({ received: true, type: event.type });
}