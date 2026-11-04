import { concederAccesoClinico } from "@/features/clinica-http/servidor";
import { consultarMisConcesiones } from "@/features/clinica-http/servidor";
export const GET = consultarMisConcesiones;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = concederAccesoClinico;
