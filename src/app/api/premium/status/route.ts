import { NextResponse } from "next/server";
import { readEffectivePlan } from "@/features/planes/premium-server";
import { createUserScopedSupabaseClient } from "@/lib/supabase/request.server";
import { getAccessTokenFromRequest, getUserFromRequest } from "@/lib/supabase/server-auth";
import { rfdetrRuntime } from "@/features/premium-vision/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Inicia sesión para consultar tu plan." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "La sesión no es válida." }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const plan = await readEffectivePlan(accessToken);
    const { data, error } = await createUserScopedSupabaseClient(accessToken)
      .from("premium_subscriptions")
      .select("status,current_period_end,cancel_at_period_end")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      plan,
      premium_vision_available: plan === "premium" && rfdetrRuntime(process.env).enabled,
      subscription: data ? {
        status: data.status,
        current_period_end: data.current_period_end,
        cancel_at_period_end: data.cancel_at_period_end,
      } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("No se pudo consultar el plan Premium desde el servidor.");
    return NextResponse.json({ error: "No se pudo verificar el plan." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
