import "server-only";
import { createClient } from "@supabase/supabase-js";
import { conAccesoAdministrativo } from "@/features/autorizacion/servidor";
import { crearClienteIdentidadServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { flujosAdministrativosHabilitados } from "./ambiente-flujos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JSON_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", Pragma: "no-cache", Vary: "Authorization" };
type Tipo = "membresias" | "resenas";

function habilitada() { return flujosAdministrativosHabilitados(process.env); }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: JSON_HEADERS }); }
function objeto(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function sameOrigin(request: Request) {
  const url = new URL(request.url), origin = request.headers.get("origin");
  return !url.search && (!origin || origin === url.origin) && request.headers.get("sec-fetch-site") !== "cross-site";
}
function takeToken(request: Request) { return /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null; }

async function llamar(request: Request, rpcName: "dentaia_manage_clinic_membership_v1" | "dentaia_moderate_reviews_v1", args: Record<string, unknown>) {
  const token = takeToken(request);
  if (!token) return json({ ok: false, codigo: "SESION_INVALIDA" }, 401);
  const verified = await crearClienteIdentidadServidor().auth.getClaims(token);
  const claims = verified.data?.claims;
  if (verified.error || !claims || claims.role !== "authenticated" || claims.aal !== "aal2"
    || typeof claims.session_id !== "string" || !UUID.test(claims.session_id) || typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) {
    return json({ ok: false, codigo: "SESION_INVALIDA" }, 401);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json({ ok: false, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);
  const origin = new URL(url);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    return json({ ok: false, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);
  }
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (target.origin !== origin.origin || target.pathname !== `/rest/v1/rpc/${rpcName}` || target.search || method !== "POST") throw new Error("TRANSPORTE_NO_PERMITIDO");
      return fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.any([AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]) });
    } },
  });
  const { data, error } = await client.rpc(rpcName, args as never).retry(false);
  if (error || !objeto(data) || typeof data.ok !== "boolean" || !Number.isInteger(data.status) || typeof data.codigo !== "string") {
    return json({ ok: false, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);
  }
  return json(data, data.status as number);
}

function crearEndpoint(tipo: Tipo) {
  const accion = tipo === "membresias" ? "membresias.gestionar" : "resenas.moderar";
  const rpc = tipo === "membresias" ? "dentaia_manage_clinic_membership_v1" : "dentaia_moderate_reviews_v1";
  const opListar = tipo === "membresias" ? "listar" : "listar";
  const get = (request: Request) => conAccesoAdministrativo(request, accion, async () => {
    if (request.method !== "GET" || !sameOrigin(request)) return json({ ok: false, codigo: "SOLICITUD_INVALIDA" }, 400);
    const args = tipo === "membresias"
      ? { p_request_id: null, p_operation: opListar, p_professional_id: null, p_clinic_id: null, p_membership_id: null }
      : { p_request_id: null, p_operation: opListar, p_review_id: null, p_report_id: null, p_status: null };
    return llamar(request, rpc, args);
  });
  const post = (request: Request) => conAccesoAdministrativo(request, accion, async () => {
    if (request.method !== "POST" || !sameOrigin(request)) return json({ ok: false, codigo: "SOLICITUD_INVALIDA" }, 400);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ ok: false, codigo: "TIPO_NO_ADMITIDO" }, 415);
    const requestId = request.headers.get("idempotency-key") ?? "";
    if (!UUID.test(requestId)) return json({ ok: false, codigo: "SOLICITUD_INVALIDA" }, 400);
    if (!habilitada()) return json({ ok: false, codigo: "ESCRITURAS_DESACTIVADAS" }, 503);
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 4096)) return json({ ok: false, codigo: "ENTRADA_INVALIDA" }, 400);
    let body: unknown;
    try { const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 4096) throw new Error(); body = JSON.parse(raw); }
    catch { return json({ ok: false, codigo: "ENTRADA_INVALIDA" }, 400); }
    if (!objeto(body)) return json({ ok: false, codigo: "ENTRADA_INVALIDA" }, 400);
    let args: Record<string, unknown>;
    if (tipo === "membresias") {
      if (Object.keys(body).some(key => !["operacion","professionalId","clinicId","membershipId"].includes(key))
        || !["vincular","revocar"].includes(String(body.operacion))
        || !UUID.test(String(body.professionalId ?? "")) || !UUID.test(String(body.clinicId ?? ""))
        || (body.operacion === "revocar" && !UUID.test(String(body.membershipId ?? "")))) return json({ ok: false, codigo: "ENTRADA_INVALIDA" }, 400);
      args = { p_request_id: requestId.toLowerCase(), p_operation: body.operacion, p_professional_id: body.professionalId,
        p_clinic_id: body.clinicId, p_membership_id: body.operacion === "revocar" ? body.membershipId : null };
    } else {
      if (Object.keys(body).some(key => !["operacion","reviewId","reportId","status"].includes(key))
        || !["resena","reporte"].includes(String(body.operacion))) return json({ ok: false, codigo: "ENTRADA_INVALIDA" }, 400);
      const isReview = body.operacion === "resena";
      const target = isReview ? body.reviewId : body.reportId;
      const status = body.status;
      if (!UUID.test(String(target ?? "")) || (isReview ? !["published","rejected","hidden"].includes(String(status)) : !["reviewed","dismissed"].includes(String(status)))) return json({ ok: false, codigo: "ENTRADA_INVALIDA" }, 400);
      args = { p_request_id: requestId.toLowerCase(), p_operation: body.operacion, p_review_id: isReview ? target : null,
        p_report_id: isReview ? null : target, p_status: status };
    }
    return llamar(request, rpc, args);
  });
  return { GET: get, POST: post };
}

export const gestionarVinculaciones = crearEndpoint("membresias");
export const gestionarModeracionResenas = crearEndpoint("resenas");
