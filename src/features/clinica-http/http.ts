import { randomUUID } from "node:crypto";
import { consultaWorkspace, workspaceDto, type TipoWorkspace } from "./workspace";
import { firmarCursor, verificarCursor } from "./cursor";
import { concesionDto, historialDto, revocacionDto } from "./dto";
import { clavesExactas, consultaHistorial, entradaConcesion, ErrorEntrada, esObjeto, esUuid, fechaIso, leerJsonAcotado } from "./validaciones";

export type RpcClinico = "grant_clinical_access" | "revoke_clinical_access" | "get_authorized_clinical_history" | "get_clinical_workspace";
export type IdentidadClinica = { id: string; sessionId: string; exp: number; roles: readonly string[] };
export type Autenticacion = { ok: true; usuario: IdentidadClinica; rpc: (name: RpcClinico, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }
  | { ok: false; status: 401 | 403 | 503 };
export type DependenciasClinicas = { enabled: boolean; cursorSecret: string; cursorTtl: number;
  autenticar: (token: string) => Promise<Autenticacion>;
  registrar?: (event: { requestId: string; operation: string; status: number; code: string }) => void };

const codes: Record<number, string> = { 400: "INVALID_REQUEST", 401: "AUTHENTICATION_REQUIRED", 403: "ACCESS_DENIED", 404: "NOT_FOUND", 409: "IDEMPOTENCY_CONFLICT", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA_TYPE", 503: "SERVICE_UNAVAILABLE" };
function response(body: Record<string, unknown>, status: number, trace: string) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", Pragma: "no-cache", Vary: "Authorization", "X-Request-Id": trace } });
}

export function crearApiClinica(deps: DependenciasClinicas) {
  async function execute(request: Request, operation: string, handler: (auth: Extract<Autenticacion, { ok: true }>, trace: string) => Promise<Response>) {
    const trace = randomUUID();
    const fail = (status: number, code = codes[status]) => {
      // Nunca headers, token, URL/IDs de paciente ni contenido clínico en logs.
      deps.registrar?.({ requestId: trace, operation, status, code });
      return response({ ok: false, code, requestId: trace }, status, trace);
    };
    try {
      if (!deps.enabled) return fail(404);
      const header = request.headers.get("authorization");
      if (!header || header.length > 8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header)) return fail(401);
      const auth = await deps.autenticar(header.slice(7));
      if (!auth.ok) return fail(auth.status);
      if (operation !== "history" && !operation.startsWith("workspace_")) {
        const origin = request.headers.get("origin"), site = request.headers.get("sec-fetch-site");
        if ((origin && origin !== new URL(request.url).origin) || site === "cross-site") return fail(403);
      }
      return await handler(auth, trace);
    } catch (e) { return e instanceof ErrorEntrada ? fail(e.status, e.codigo) : fail(503); }
  }
  async function invoke(auth: Extract<Autenticacion, { ok: true }>, name: RpcClinico, args: Record<string, unknown>, trace: string) {
    const result = await auth.rpc(name, args);
    if (result.error || !esObjeto(result.data) || typeof result.data.ok !== "boolean" || !Number.isInteger(result.data.status) || !esUuid(result.data.requestId)) throw new Error("RPC_UNAVAILABLE");
    const raw = result.data, status = raw.status as number;
    if (!raw.ok) {
      if (![400, 401, 403, 409, 503].includes(status)) throw new Error("INVALID_RPC_STATUS");
      return { raw, denied: response({ ok: false, code: codes[status], requestId: raw.requestId }, status, trace) };
    }
    if (![200, 201].includes(status)) throw new Error("INVALID_RPC_STATUS");
    return { raw, denied: null };
  }
  return {
    workspace: (request: Request, kind: TipoWorkspace) => execute(request, "workspace_" + kind, async (auth, trace) => {
      const query = consultaWorkspace(request, kind);
      const r = await invoke(auth, "get_clinical_workspace", query, trace);
      if (r.denied) return r.denied;
      const dto = workspaceDto(r.raw, kind);
      if (query.p_membership_id !== null && dto.data.membershipId !== query.p_membership_id) throw new Error("INVALID_CONTEXT");
      return response({ ok: true, ...dto, requestId: r.raw.requestId }, 200, trace);
    }),
    conceder: (request: Request) => execute(request, "grant", async (auth, trace) => {
      if (new URL(request.url).search) throw new ErrorEntrada(400, "INVALID_REQUEST");
      const id = request.headers.get("idempotency-key");
      if (!esUuid(id)) throw new ErrorEntrada(400, "INVALID_REQUEST");
      const body = entradaConcesion(await leerJsonAcotado(request));
      const r = await invoke(auth, "grant_clinical_access", { p_id: id.toLowerCase(), p_membership_id: body.membershipId,
        p_encounter_ids: body.encounterIds, p_expires_at: body.expiresAt, p_policy_version: body.policyVersion, p_accepted: body.accepted }, trace);
      if (r.denied) return r.denied;
      return response({ ok: true, ...concesionDto(r.raw, id.toLowerCase()), requestId: r.raw.requestId }, r.raw.status as number, trace);
    }),
    revocar: (request: Request, id: string) => execute(request, "revoke", async (auth, trace) => {
      if (!esUuid(id) || new URL(request.url).search) throw new ErrorEntrada(400, "INVALID_REQUEST");
      const body = await leerJsonAcotado(request);
      if (!clavesExactas(body, [])) throw new ErrorEntrada(400, "INVALID_REQUEST");
      const r = await invoke(auth, "revoke_clinical_access", { p_id: id.toLowerCase() }, trace);
      if (r.denied) return r.denied;
      return response({ ok: true, ...revocacionDto(r.raw, id.toLowerCase()), requestId: r.raw.requestId }, 200, trace);
    }),
    historial: (request: Request, patientId: string) => execute(request, "history", async (auth, trace) => {
      if (!esUuid(patientId)) throw new ErrorEntrada(400, "INVALID_REQUEST");
      patientId = patientId.toLowerCase();
      const query = consultaHistorial(request);
      const binding = { actor: auth.usuario.id, session: auth.usuario.sessionId, patient: patientId, membership: query.membershipId, limit: query.limit };
      const cursor = query.cursor ? verificarCursor(deps.cursorSecret, query.cursor, binding) : null;
      if (query.cursor && (!cursor || !fechaIso(cursor.position.beforeAt) || !esUuid(cursor.position.beforeId))) throw new ErrorEntrada(400, "INVALID_CURSOR");
      const r = await invoke(auth, "get_authorized_clinical_history", { p_patient_id: patientId, p_membership_id: query.membershipId, p_limit: query.limit,
        p_before_at: cursor?.position.beforeAt ?? null, p_before_id: cursor?.position.beforeId ?? null }, trace);
      if (r.denied) return r.denied;
      const dto = historialDto(r.raw, patientId);
      if (cursor && (cursor.professional !== dto.context.professional || cursor.clinic !== dto.context.clinic)) throw new ErrorEntrada(400, "INVALID_CURSOR");
      const nextCursor = dto.position ? firmarCursor(deps.cursorSecret, binding, dto.context, dto.position, deps.cursorTtl, auth.usuario.exp) : null;
      return response({ ok: true, ...dto.data, nextCursor, requestId: r.raw.requestId }, 200, trace);
    }),
  };
}
