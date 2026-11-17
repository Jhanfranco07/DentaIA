import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";
import { getStripe } from "@/lib/stripe/server";
import { PLAN_PREMIUM } from "@/lib/stripe/plan";
import { siteUrl } from "@/lib/stripe/urls";

const response = (status: number, body: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof getUserFromRequest>>;
  try {
    user = await getUserFromRequest(req);
  } catch {
    console.error("No se pudo verificar la identidad para Checkout.");
    return response(503, { error: "No se pudo verificar tu sesión." });
  }
  if (!user) {
    return response(401, { error: "Inicia sesión para continuar." });
  }

  let baseUrl: string;
  try {
    baseUrl = siteUrl();
  } catch {
    console.error("NEXT_PUBLIC_SITE_URL no está configurada correctamente.");
    return response(503, { error: "El pago de prueba no está disponible en este entorno." });
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
      success_url: `${baseUrl}/premium/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/premium/cancelado`,
    });

    if (!session.url) throw new Error("Stripe no devolvió la URL de Checkout.");
    return NextResponse.json(
      { id: session.id, url: session.url },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("No se pudo crear la sesión Stripe de prueba.");
    return response(502, { error: "No se pudo iniciar el pago de prueba." });
  }
}