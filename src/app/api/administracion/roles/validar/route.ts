import { validarPropuestaRol } from "@/features/administracion/servidor";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Solo valida; no persiste asignaciones ni modifica cuentas.
export async function POST(request: Request) { return validarPropuestaRol(request); }
