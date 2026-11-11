import { gestionarVinculaciones } from "@/features/administracion/servidor-flujos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = gestionarVinculaciones.GET;
export const POST = gestionarVinculaciones.POST;
