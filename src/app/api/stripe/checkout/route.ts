import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";
import { getStripe } from "@/lib/stripe/server"

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

    const session = await getStripe().checkout.sessions.create({
    mode: "payment",
  });

  return NextResponse.json({ id: session.id });
}