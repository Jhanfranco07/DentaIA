export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const { validarLecturaDesdeSesion } = await import("@/features/administracion/validacion-lectura-servidor");
  return validarLecturaDesdeSesion(request);
}
