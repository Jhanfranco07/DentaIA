import { consultarHistorialPremium } from "@/features/clinica-http/servidor";

export const dynamic = "force-dynamic";
export const POST = (request: Request) => consultarHistorialPremium(request, true);
