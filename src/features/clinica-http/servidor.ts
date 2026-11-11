import "server-only";
import { createClient } from "@supabase/supabase-js";
import { leerAsignacionAdministrativa } from "../autorizacion/autorizacion";
import { crearApiClinica, type Autenticacion } from "./http";
import { esUuid } from "./validaciones";
import { configurarClinica, origenLocalAutorizado, origenPreviewAutorizado, cuentaAcademicaPermitida } from "./ambiente";

function errorIdentidad(error: unknown): 401 | 503 {
  if (error instanceof TypeError || (error instanceof Error && ["TimeoutError", "AbortError", "AuthRetryableFetchError"].includes(error.name))) return 503;
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && (error.status >= 500 || error.status === 429 || error.status === 0)) return 503;
  return 401;
}

function diagnosticoConfiguracion(config: ReturnType<typeof configurarClinica>): "ENTORNO_NO_PERMITIDO" | "BFF_DESHABILITADO" | "CONFIGURACION_INVALIDA" {
  if (!config.preview && process.env.NODE_ENV !== "development") return "ENTORNO_NO_PERMITIDO";
  if (!config.enabled && config.valid) return "BFF_DESHABILITADO";
  return "CONFIGURACION_INVALIDA";
}

function clavePublicable(key: string) {
  if (key.startsWith("sb_publishable_")) return true;
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon"; }
  catch { return false; }
}
function api(request: Request) {
  const config = configurarClinica(process.env);
  const originAllowed = config.preview
    ? origenPreviewAutorizado(request, process.env)
    : origenLocalAutorizado(request);
  const enabled = config.enabled && (!config.remote || originAllowed);
  return crearApiClinica({ enabled, cursorSecret: config.secret, cursorTtl: config.ttl,
    ...(!enabled ? { diagnosticoConfiguracion: diagnosticoConfiguracion(config) } : {}),
    ...(config.remote ? { environment: "academic_remote" as const } : {}),
    registrar: event => console.info("clinical_security", JSON.stringify(event)),
    autenticar: async (token): Promise<Autenticacion> => {
      let client;
      try {
        if (!config.valid || !clavePublicable(config.key)) return { ok: false, status: 503, diagnostico: "CONFIGURACION_INVALIDA" };
        client = createClient(config.origin, config.key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, {
            ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
          }) },
        });
      } catch { return { ok: false, status: 503 }; }
      try {
        // Verificación SDK (JWKS o Auth para HS256), no un simple decode de JWT.
        const verified = await client.auth.getClaims(token);
        if (verified.error || !verified.data) {
          const status = errorIdentidad(verified.error);
          return { ok: false, status, diagnostico: status === 503 ? "PROVEEDOR_IDENTIDAD_NO_DISPONIBLE" : "SESION_INVALIDA" };
        }
        const claims = verified.data.claims;
        const current = await client.auth.getUser(token);
        if (current.error || !current.data.user) {
          const status = errorIdentidad(current.error);
          return { ok: false, status, diagnostico: status === 503 ? "PROVEEDOR_IDENTIDAD_NO_DISPONIBLE" : "SESION_INVALIDA" };
        }
        const user = current.data.user;
        if (config.remote && !cuentaAcademicaPermitida(user.id, user.app_metadata, config.users)) return { ok: false, status: 403, diagnostico: "CUENTA_FUERA_DE_ALLOWLIST" };
        if (!esUuid(user.id) || claims.sub !== user.id || claims.role !== "authenticated" || !esUuid(claims.session_id)
          || typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000) || user.is_anonymous === true || user.aud !== "authenticated" || !user.confirmed_at) return { ok: false, status: 401, diagnostico: "SESION_INVALIDA" };
        // Reutiliza el contrato de DI-150, sin su autorización administrativa/AAL2.
        const assignment = leerAsignacionAdministrativa(user.app_metadata);
        if (!assignment || assignment.roles.length > 3 || new Set(assignment.roles).size !== assignment.roles.length) return { ok: false, status: 403, diagnostico: "ROL_INSUFICIENTE" };
        // La decisión clínica por acción se conserva en el RPC para auditar denegaciones.
        return { ok: true, usuario: { id: user.id, sessionId: claims.session_id, exp: claims.exp, roles: assignment.roles },
          rpc: async (name, args) => { const { data, error } = await client.rpc(name, args); return { data, error }; } };
      } catch (error) { const status = errorIdentidad(error); return { ok: false, status,
        diagnostico: status === 503 ? "PROVEEDOR_IDENTIDAD_NO_DISPONIBLE" : "SESION_INVALIDA" }; }
    },
  });
}

export const concederAccesoClinico = (request: Request) => api(request).conceder(request);
export const revocarAccesoClinico = async (request: Request, context: { params: Promise<{ id: string }> }) => api(request).revocar(request, (await context.params).id);
export const consultarHistorialClinico = async (request: Request, context: { params: Promise<{ patientId: string }> }) => api(request).historial(request, (await context.params).patientId);
export const consultarMiPaciente = (request: Request) => api(request).workspace(request, "patient");
export const consultarMiProfesional = (request: Request) => api(request).workspace(request, "professional");
export const consultarMisConcesiones = (request: Request) => api(request).workspace(request, "grants");
export const consultarPacientesAutorizados = (request: Request) => api(request).workspace(request, "patients");
export const consultarSolicitudesProfesionales = (request: Request) => api(request).workspace(request, "requests");
