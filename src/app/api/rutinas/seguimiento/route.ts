import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { leerJsonAcotado } from "@/features/clinica-http/validaciones";
import { esIdentificador, validarOperacionSeguimiento } from "@/features/rutinas/validarSeguimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Este endpoint NO se activa hasta aplicar y verificar el esquema en QA.
// Activación explícita exclusivamente desde una variable privada del servidor.
const habilitado = () => process.env.DENTAIA_SEGUIMIENTO_RUTINAS_HABILITADO === "true";
const encabezados = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
};
const responder = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: encabezados });

type Sesion = {
  usuarioId: string;
  roles: string[];
  administrador: ReturnType<typeof getSupabaseAdmin>;
};
async function autenticar(request: Request): Promise<Sesion | null> {
  const header = request.headers.get("authorization");
  if (!header || header.length > 8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)) return null;
  const administrador = getSupabaseAdmin();
  const { data, error } = await administrador.auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  const meta = data.user.app_metadata?.dentaia;
  if (!meta || typeof meta !== "object" || !("estado" in meta) || meta.estado !== "activo") return null;
  const roles = "roles" in meta && Array.isArray(meta.roles)
    ? meta.roles.filter((r: unknown): r is string => typeof r === "string") : [];
  if (!roles.includes("paciente") && !roles.includes("odontologo")) return null;
  return { usuarioId: data.user.id, roles, administrador };
}
const codigoError = (codigo?: string): number =>
  codigo === "42501" ? 403 : codigo === "23505" ? 409
  : codigo === "22023" ? 400 : 503;

export async function GET(request: Request) {
  if (!habilitado()) return responder(404, { ok: false, error: "FUNCION_NO_HABILITADA" });
  try {
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(k => k !== "membershipId")
       || url.searchParams.getAll("membershipId").length > 1) return responder(400, { ok:false, error:"SOLICITUD_INVALIDA" });
    const membresia = url.searchParams.get("membershipId");
    if (membresia !== null && !esIdentificador(membresia)) return responder(400, { ok:false, error:"SOLICITUD_INVALIDA" });
    const sesion = await autenticar(request);
    if (!sesion) return responder(401, { ok:false, error:"SESION_INVALIDA" });
    const { data, error } = await sesion.administrador.rpc("consultar_seguimiento_rutina", {
      p_actor_user_id: sesion.usuarioId, p_membership_id: membresia,
    });
    if (error) return responder(codigoError(error.code), { ok:false, error:"CONSULTA_NO_DISPONIBLE" });
    if (!data || typeof data !== "object" || Array.isArray(data)) return responder(503, { ok:false, error:"RESPUESTA_INVALIDA" });
    return responder(200, { ...data });
  } catch { return responder(503, { ok:false, error:"SERVICIO_NO_DISPONIBLE" }); }
}

export async function POST(request: Request) {
  if (!habilitado()) return responder(404, { ok:false, error:"FUNCION_NO_HABILITADA" });
  const origen = request.headers.get("origin");
  const sitio = request.headers.get("sec-fetch-site");
  if ((origen && origen !== new URL(request.url).origin) || sitio === "cross-site")
    return responder(403, { ok:false, error:"ORIGEN_DENEGADO" });
  try {
    const sesion = await autenticar(request);
    if (!sesion) return responder(401, { ok:false, error:"SESION_INVALIDA" });
    const cuerpo = await leerJsonAcotado(request);
    const operacion = validarOperacionSeguimiento(cuerpo, sesion.roles);
    if (!operacion) return responder(400, { ok:false, error:"SOLICITUD_INVALIDA" });
    const { data, error } = await sesion.administrador.rpc("operar_seguimiento_rutina", {
      p_actor_user_id: sesion.usuarioId, ...operacion,
    });
    if (error) return responder(codigoError(error.code), { ok:false, error:"OPERACION_RECHAZADA" });
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true)
      return responder(503, { ok:false, error:"RESPUESTA_INVALIDA" });
    return responder(200, { ok:true });
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
      return responder([400,413,415].includes(error.status) ? error.status : 400, {ok:false,error:"SOLICITUD_INVALIDA"});
    }
    return responder(503, { ok:false, error:"SERVICIO_NO_DISPONIBLE" });
  }
}
