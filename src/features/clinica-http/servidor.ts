import "server-only";
import { createClient } from "@supabase/supabase-js";
import { leerAsignacionAdministrativa } from "../autorizacion/autorizacion";
import { crearApiClinica, type Autenticacion } from "./http";
import { esUuid } from "./validaciones";

function errorIdentidad(error: unknown): 401 | 503 {
  if (error instanceof TypeError || (error instanceof Error && ["TimeoutError", "AbortError", "AuthRetryableFetchError"].includes(error.name))) return 503;
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && (error.status >= 500 || error.status === 429 || error.status === 0)) return 503;
  return 401;
}

function clavePublicable(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon"; }
  catch { return false; }
}
function api() {
  // Esta fase queda limitada a QA local y apagada en producción.
  const enabled = process.env.NODE_ENV !== "production" && process.env.DENTAIA_CLINICAL_HTTP_ENABLED === "true";
  const secret = process.env.DENTAIA_CLINICAL_CURSOR_SECRET ?? "";
  const ttl = Number(process.env.DENTAIA_CLINICAL_CURSOR_TTL_SECONDS ?? "300");
  return crearApiClinica({ enabled, cursorSecret: secret, cursorTtl: ttl,
    registrar: event => console.info("clinical_security", JSON.stringify(event)),
    autenticar: async (token): Promise<Autenticacion> => {
      let client;
      try {
        const url = new URL(process.env.DENTAIA_CLINICAL_SUPABASE_URL ?? "");
        const key = process.env.DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY ?? "";
        if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== "/"
          || !clavePublicable(key) || !/^[A-Za-z0-9_-]{43,86}$/.test(secret) || Buffer.from(secret, "base64url").length < 32
          || !Number.isInteger(ttl) || ttl < 1 || ttl > 900) return { ok: false, status: 503 };
        client = createClient(url.origin, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, {
            ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
          }) },
        });
      } catch { return { ok: false, status: 503 }; }
      try {
        // Verificación SDK (JWKS o Auth para HS256), no un simple decode de JWT.
        const verified = await client.auth.getClaims(token);
        if (verified.error || !verified.data) return { ok: false, status: errorIdentidad(verified.error) };
        const claims = verified.data.claims;
        const current = await client.auth.getUser(token);
        if (current.error || !current.data.user) return { ok: false, status: errorIdentidad(current.error) };
        const user = current.data.user;
        if (!esUuid(user.id) || claims.sub !== user.id || claims.role !== "authenticated" || !esUuid(claims.session_id)
          || typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000) || user.is_anonymous === true || user.aud !== "authenticated" || !user.confirmed_at) return { ok: false, status: 401 };
        // Reutiliza el contrato de DI-150, sin su autorización administrativa/AAL2.
        const assignment = leerAsignacionAdministrativa(user.app_metadata);
        if (!assignment || assignment.roles.length > 3 || new Set(assignment.roles).size !== assignment.roles.length) return { ok: false, status: 403 };
        // La decisión clínica por acción se conserva en el RPC para auditar denegaciones.
        return { ok: true, usuario: { id: user.id, sessionId: claims.session_id, exp: claims.exp, roles: assignment.roles },
          rpc: async (name, args) => { const { data, error } = await client.rpc(name, args); return { data, error }; } };
      } catch (error) { return { ok: false, status: errorIdentidad(error) }; }
    },
  });
}

export const concederAccesoClinico = (request: Request) => api().conceder(request);
export const revocarAccesoClinico = async (request: Request, context: { params: Promise<{ id: string }> }) => api().revocar(request, (await context.params).id);
export const consultarHistorialClinico = async (request: Request, context: { params: Promise<{ patientId: string }> }) => api().historial(request, (await context.params).patientId);
export const consultarMiPaciente = (request: Request) => api().workspace(request, "patient");
export const consultarMiProfesional = (request: Request) => api().workspace(request, "professional");
export const consultarMisConcesiones = (request: Request) => api().workspace(request, "grants");
export const consultarPacientesAutorizados = (request: Request) => api().workspace(request, "patients");
export const consultarSolicitudesProfesionales = (request: Request) => api().workspace(request, "requests");
