import { gestionarModeracionResenas } from "@/features/administracion/servidor-flujos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = gestionarModeracionResenas.GET;
export const POST = gestionarModeracionResenas.POST;
