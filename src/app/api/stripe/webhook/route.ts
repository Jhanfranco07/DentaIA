import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: Request) {
  // El cuerpo debe leerse crudo: si se parsea como JSON, la firma no coincide.
  const body = await req.text();
  return NextResponse.json({ received: true, bytes: body.length });
}