import { listarUsuariosAdministrativos } from "@/features/administracion/servidor";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) { return listarUsuariosAdministrativos(request); }
