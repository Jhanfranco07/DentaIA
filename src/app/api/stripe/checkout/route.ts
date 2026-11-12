import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server-auth";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

  return NextResponse.json({ error: "Pendiente de implementar" }, { status: 501 });
}