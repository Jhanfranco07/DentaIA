import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";
import { getStripe } from "@/lib/stripe/server"
import { PLAN_PREMIUM } from "@/lib/stripe/plan"
import { siteUrl } from "@/lib/stripe/urls"

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

    const session = await getStripe().checkout.sessions.create({
        line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PLAN_PREMIUM.currency,
          unit_amount: PLAN_PREMIUM.amount,
          product_data: { name: PLAN_PREMIUM.name },
        },
      },
    ],

    client_reference_id: user.id,
    customer_email: user.email ?? undefined,
    metadata: { plan: PLAN_PREMIUM.id },
    success_url: `${siteUrl()}/premium/exito?session_id={CHECKOUT_SESSION_ID}`,
    mode: "payment",
  });

  return NextResponse.json({ id: session.id });
}