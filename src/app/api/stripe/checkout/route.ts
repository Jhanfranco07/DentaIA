import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";
import { getStripe } from "@/lib/stripe/server"
import { PLAN_PREMIUM } from "@/lib/stripe/plan"

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
    mode: "payment",
  });

  return NextResponse.json({ id: session.id });
}