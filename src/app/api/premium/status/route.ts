import { NextResponse } from "next/server";
import { readEffectivePlan } from "@/features/planes/premium-server";
import { getAccessTokenFromRequest, getUserFromRequest } from "@/lib/supabase/server-auth";

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
    return NextResponse.json({ plan }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("No se pudo consultar el plan Premium desde el servidor.");
    return NextResponse.json({ error: "No se pudo verificar el plan." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
