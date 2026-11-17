import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { authorizeVisionDemo, consumeVisionAnalysisLimit, consumeVisionExplanationLimit } from "./vision-demo.ts";

const id = "11111111-2222-4333-8444-555555555555";
const headers = (value = "Bearer valid-session-token") => new Headers(value ? { authorization: value } : {});
const createClient = (user, error = null) => () => ({ auth: { getUser: async (token) => {
  assert.equal(token, "valid-session-token");
  return { data: { user }, error };
} } });
const activeUser = { id, aud: "authenticated", confirmed_at: "2026-10-01T00:00:00Z", is_anonymous: false,
  app_metadata: { dentaia: { version: 1, estado: "activo", roles: ["paciente"] } } };

test("vision requires a bearer session before contacting Supabase", async () => {
  let contacted = false;
  const client = () => { contacted = true; return createClient(activeUser)(); };
  assert.equal((await authorizeVisionDemo(headers(""), client)).status, 401);
  assert.equal(contacted, false);
});

test("active patients and superadministrators are authorized without a UUID allowlist", async () => {
  assert.deepEqual(await authorizeVisionDemo(headers(), createClient(activeUser)), { allowed: true, userId: id });
  assert.deepEqual(await authorizeVisionDemo(headers(), createClient({ ...activeUser, app_metadata: { dentaia: { version: 1, estado: "activo", roles: ["superusuario"] } } })), { allowed: true, userId: id });
});

test("anonymous, invalid, suspended, unconfirmed and unauthorized roles remain blocked", async () => {
  assert.equal((await authorizeVisionDemo(headers(), createClient({ ...activeUser, is_anonymous: true }))).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient({ ...activeUser, confirmed_at: null }))).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient({ ...activeUser, banned_until: "2099-01-01T00:00:00Z" }))).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient({ ...activeUser, app_metadata: { dentaia: { version: 1, estado: "suspendido", roles: ["paciente"] } } }))).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient({ ...activeUser, app_metadata: { dentaia: { version: 1, estado: "activo", roles: ["odontologo"] } } }))).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient(null, { status: 401 }))).status, 401);
  assert.equal((await authorizeVisionDemo(headers(), createClient(null, { status: 503 }))).status, 503);
});

test("distributed explanation limit blocks at six and fails closed on provider error", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ result: [6, 521] });
  };
  const limited = await consumeVisionExplanationLimit(id, "https://redis.example.test", "test-token", fetcher);
  assert.deepEqual(limited, { allowed: false, status: 429, retryAfter: 521 });
  assert.equal(calls.length, 1);
  assert.match(calls[0].init.body, /dentaia:vision:explain:/);
  assert.doesNotMatch(calls[0].init.body, new RegExp(id));
  assert.equal((await consumeVisionExplanationLimit(id, undefined, undefined)).status, 503);
  assert.equal((await consumeVisionExplanationLimit(id, "https://redis.example.test", "token", async () => { throw new Error("private"); })).status, 503);
});

test("analysis limit uses an isolated lower-cost key", async () => {
  const limited = await consumeVisionAnalysisLimit(id, "https://redis.example.test", "test-token", async (_url, init) => {
    assert.match(init.body, /dentaia:vision:analyze:/);
    return Response.json({ result: [4, 600] });
  });
  assert.deepEqual(limited, { allowed: false, status: 429, retryAfter: 600 });
});

test("Smile endpoints authorize before reading input or calling downstream services", () => {
  const smileRoute = readFileSync(new URL("../../app/api/desarrollo/dentaia-smile/route.ts", import.meta.url), "utf8");
  const smileExplainRoute = readFileSync(new URL("../../app/api/desarrollo/dentaia-smile/explain/route.ts", import.meta.url), "utf8");
  assert.ok(smileRoute.indexOf("authorizeVisionDemoRequest(request.headers)") < smileRoute.indexOf("request.formData()"));
  assert.ok(smileRoute.indexOf("consumeVisionAnalysisRequestLimit(access.userId)") < smileRoute.indexOf("request.formData()"));
  assert.ok(smileExplainRoute.indexOf("authorizeVisionDemoRequest(request.headers)") < smileExplainRoute.indexOf("request.text()"));
  assert.ok(smileExplainRoute.indexOf("consumeVisionExplanationLimit") < smileExplainRoute.indexOf("https://api.openai.com/v1/responses"));
});
