import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { authorizeVisionDemo, consumeVisionExplanationLimit } from "./vision-demo.ts";

const id = "11111111-2222-4333-8444-555555555555";
const headers = (value = "Bearer valid-session-token") => new Headers(value ? { authorization: value } : {});
const createClient = (user, error = null) => () => ({ auth: { getUser: async (token) => {
  assert.equal(token, "valid-session-token");
  return { data: { user }, error };
} } });
const activeUser = { id, aud: "authenticated", confirmed_at: "2026-10-01T00:00:00Z" };

test("vision demo requires a bearer session and a configured allowlist", async () => {
  let contacted = false;
  const client = () => { contacted = true; return createClient(activeUser)(); };
  assert.equal((await authorizeVisionDemo(headers(""), client, id)).status, 401);
  assert.equal((await authorizeVisionDemo(headers(), client, undefined)).code, "ALLOWLIST_UNCONFIGURED");
  assert.equal(contacted, false);
});

test("only a fresh authenticated non-anonymous allowlisted user is authorized", async () => {
  assert.deepEqual(await authorizeVisionDemo(headers(), createClient(activeUser), id), { allowed: true, userId: id });
  assert.equal((await authorizeVisionDemo(headers(), createClient(activeUser), "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient({ ...activeUser, is_anonymous: true }), id)).status, 403);
  assert.equal((await authorizeVisionDemo(headers(), createClient(null, { status: 401 }), id)).status, 401);
  assert.equal((await authorizeVisionDemo(headers(), createClient(null, { status: 503 }), id)).status, 503);
  assert.equal((await authorizeVisionDemo(headers(), createClient(activeUser), `${id},bad-id`)).status, 503);
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

test("both vision endpoints authorize before reading input or calling downstream services", () => {
  const visionRoute = readFileSync(new URL("../../app/api/desarrollo/vision-poc/route.ts", import.meta.url), "utf8");
  const explainRoute = readFileSync(new URL("../../app/api/desarrollo/vision-poc/explain/route.ts", import.meta.url), "utf8");
  assert.ok(visionRoute.indexOf("authorizeVisionDemoRequest(request.headers)") < visionRoute.indexOf("request.arrayBuffer()"));
  assert.ok(explainRoute.indexOf("authorizeVisionDemoRequest(request.headers)") < explainRoute.indexOf("request.text()"));
  assert.ok(explainRoute.indexOf("consumeVisionExplanationLimit") < explainRoute.indexOf("https://api.openai.com/v1/responses"));
  assert.match(explainRoute, /max_output_tokens: 200/);
});
