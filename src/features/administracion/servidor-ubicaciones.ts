import "server-only";
import { createClient } from "@supabase/supabase-js";
import { conAccesoAdministrativo } from "@/features/autorizacion/servidor";
import { crearClienteIdentidadServidor } from "@/lib/supabase/server";
import { ErrorEntradaUbicacion, leerOperacionUbicacion, validarResultadoUbicacion } from "./ubicaciones";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const limiteBody = 16 * 1024;

function respuesta(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", Pragma: "no-cache", Vary: "Authorization" } });
}

function habilitada() {
  if (process.env.DENTAIA_LOCATION_WRITES_ENABLED !== "true") return false;
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.VERCEL_ENV) return true;
  return process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "develop";
}

async function leerBody(request: Request): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limiteBody)) throw new ErrorEntradaUbicacion();
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > limiteBody) throw new ErrorEntradaUbicacion();
  try { return JSON.parse(raw); } catch { throw new ErrorEntradaUbicacion(); }
}

export const gestionarUbicaciones = (request: Request) => conAccesoAdministrativo(request, "ubicaciones.gestionar", async contexto => {
  try {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (request.method !== "POST" || url.search || (origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return respuesta({ ok: false, codigo: "SOLICITUD_INVALIDA" }, 400);
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return respuesta({ ok: false, codigo: "TIPO_NO_ADMITIDO" }, 415);
    const solicitud = request.headers.get("idempotency-key") ?? "";
    if (!UUID.test(solicitud)) return respuesta({ ok: false, codigo: "SOLICITUD_INVALIDA" }, 400);
    if (!habilitada()) return respuesta({ ok: false, codigo: "ESCRITURAS_DESACTIVADAS" }, 503);

    const token = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) return respuesta({ ok: false, codigo: "SESION_INVALIDA" }, 401);
    const verified = await crearClienteIdentidadServidor().auth.getClaims(token);
    const claims = verified.data?.claims;
    if (verified.error || !claims || claims.sub !== contexto.usuarioId || claims.role !== "authenticated" || claims.aal !== "aal2"
      || typeof claims.session_id !== "string" || !UUID.test(claims.session_id) || typeof claims.exp !== "number"
      || !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now() / 1000) return respuesta({ ok: false, codigo: "SESION_INVALIDA" }, 401);

    const operacion = leerOperacionUbicacion(await leerBody(request));
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return respuesta({ ok: false, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);
    const base = new URL(supabaseUrl);
    if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
      return respuesta({ ok: false, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);
    }
    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
        const target = new URL(input instanceof Request ? input.url : String(input));
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        if (target.origin !== base.origin || target.pathname !== "/rest/v1/rpc/dentaia_gestionar_ubicacion_v1" || target.search || method !== "POST") {
          throw new Error("TRANSPORTE_NO_PERMITIDO");
        }
        return fetch(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.any([AbortSignal.timeout(8000), ...(init?.signal ? [init.signal] : [])]) });
      } },
    });
    const { data, error } = await client.rpc("dentaia_gestionar_ubicacion_v1", {
      p_solicitud: solicitud.toLowerCase(), p_operacion: operacion.operacion,
      p_ubicacion_id: operacion.operacion === "guardar" ? null : operacion.ubicacionId,
      p_dentist_id: operacion.operacion === "guardar" ? operacion.dentistId : null,
      p_clinic_id: operacion.operacion === "guardar" ? operacion.clinicId : null,
      p_practice_name: operacion.operacion === "guardar" ? operacion.practiceName : null,
      p_practice_address: operacion.operacion === "guardar" ? operacion.practiceAddress : null,
      p_latitude: operacion.operacion === "guardar" ? operacion.latitude : null,
      p_longitude: operacion.operacion === "guardar" ? operacion.longitude : null,
      p_verification_reference: operacion.operacion === "publicar" ? operacion.verificationReference : null,
    }).retry(false);
    if (error) throw new Error("RPC_NO_DISPONIBLE");
    const result = validarResultadoUbicacion(data);
    console.info("location_admin", JSON.stringify({ status: result.status, code: result.codigo }));
    return respuesta(result, result.status);
  } catch (error) {
    if (error instanceof ErrorEntradaUbicacion) return respuesta({ ok: false, codigo: error.codigo }, error.status);
    console.info("location_admin", JSON.stringify({ status: 503, code: "SERVICIO_NO_DISPONIBLE" }));
    return respuesta({ ok: false, codigo: "SERVICIO_NO_DISPONIBLE" }, 503);
  }
});
