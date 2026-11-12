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

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
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
      cancel_url: `${siteUrl()}/premium/cancelado`,
    });

    return NextResponse.json({ id: session.id });
  } catch (error) {
        console.error("Error de Stripe:", error instanceof Error ? error.message : "desconocido");
    return NextResponse.json({ error: "No se pudo iniciar el pago de prueba." }, { status: 502 });
  }
}