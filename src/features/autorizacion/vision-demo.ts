import { createHash } from "node:crypto";
import { rolesDesdeAppMetadata } from "./roles.ts";

type IdentityClient = { auth: { getUser: (token: string) => Promise<{ data: { user: unknown | null }; error: { status?: number } | null }> } };
type CreateIdentityClient = () => IdentityClient;

export type VisionAccess =
  | { allowed: true; userId: string }
  | { allowed: false; status: 401 | 403 | 503; code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "AUTH_UNAVAILABLE" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Authorizes active patients and superadministrators from Auth app_metadata only. */
export async function authorizeVisionDemo(
  headers: Headers,
  createClient: CreateIdentityClient,
): Promise<VisionAccess> {
  const authorization = headers.get("authorization");
  if (!authorization || authorization.length > 8192) {
    return { allowed: false, status: 401, code: "AUTH_REQUIRED" };
  }
  const token = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(authorization)?.[1];
  if (!token) return { allowed: false, status: 401, code: "AUTH_REQUIRED" };

  try {
    const { data, error } = await createClient().auth.getUser(token);
    if (error) {
      const invalid = [400, 401, 403, 422].includes(error.status ?? 0);
      return { allowed: false, status: invalid ? 401 : 503, code: invalid ? "AUTH_REQUIRED" : "AUTH_UNAVAILABLE" };
    }
    const user = data.user as { id?: unknown; aud?: unknown; is_anonymous?: unknown; deleted_at?: unknown; confirmed_at?: unknown; banned_until?: unknown; app_metadata?: unknown } | null;
    const bannedUntil = user?.banned_until;
    const suspensionInvalid = bannedUntil != null && bannedUntil !== "" && (typeof bannedUntil !== "string" || !Number.isFinite(Date.parse(bannedUntil)));
    const suspended = typeof bannedUntil === "string" && Number.isFinite(Date.parse(bannedUntil)) && Date.parse(bannedUntil) > Date.now();
    const confirmed = typeof user?.confirmed_at === "string" && Number.isFinite(Date.parse(user.confirmed_at));
    const roles = rolesDesdeAppMetadata(user?.app_metadata);
    if (!user || typeof user.id !== "string" || !UUID.test(user.id)
      || user.aud !== "authenticated" || user.is_anonymous === true || user.deleted_at
      || !confirmed || suspensionInvalid || suspended
      || !roles.some(role => role === "paciente" || role === "superusuario")) {
      return { allowed: false, status: 403, code: "ACCESS_DENIED" };
    }
    return { allowed: true, userId: user.id };
  } catch {
    return { allowed: false, status: 503, code: "AUTH_UNAVAILABLE" };
  }
}

export type LimitResult = { allowed: true } | { allowed: false; status: 429 | 503; retryAfter?: number };
const RATE_WINDOW_SECONDS = 600;
const RATE_LIMIT = 5;
const RATE_SCRIPT = "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {count,redis.call('TTL',KEYS[1])}";

/** Atomic user-scoped Upstash REST limiter. Missing configuration and service failures fail closed. */
export async function consumeVisionExplanationLimit(
  userId: string,
  urlValue: string | undefined,
  token: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<LimitResult> {
  if (!urlValue || !token) return { allowed: false, status: 503 };
  let url: URL;
  try {
    url = new URL(urlValue);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return { allowed: false, status: 503 };
  } catch {
    return { allowed: false, status: 503 };
  }
  const userHash = createHash("sha256").update(userId).digest("hex");
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", RATE_SCRIPT, 1, `dentaia:vision:explain:${userHash}`, RATE_WINDOW_SECONDS]),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return { allowed: false, status: 503 };
    const body: unknown = await response.json();
    const result = body && typeof body === "object" ? (body as { result?: unknown }).result : undefined;
    if (!Array.isArray(result) || typeof result[0] !== "number" || typeof result[1] !== "number") {
      return { allowed: false, status: 503 };
    }
    if (result[0] > RATE_LIMIT) return { allowed: false, status: 429, retryAfter: Math.max(1, result[1]) };
    return { allowed: true };
  } catch {
    return { allowed: false, status: 503 };
  }
}
