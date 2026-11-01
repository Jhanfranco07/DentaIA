import { comprobarAccesoAdministrativo } from "@/features/autorizacion/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Solo comprueba acceso. No crea sesión, no modifica roles, no sirve el panel DI-149.
export async function GET(request: Request) {
  return comprobarAccesoAdministrativo(request);
}
