"use strict";

const assert = require("node:assert/strict");
const net = require("node:net");
const dgram = require("node:dgram");
const tls = require("node:tls");
const dns = require("node:dns");
const fixtures = require("./fixtures.json");

assert.equal(process.env.DENTAIA_E2E_NETWORK_GUARD, "1");
assert.equal(globalThis[Symbol.for("dentaia.e2e.networkGuard")], true, "network guard was not preloaded by NODE_OPTIONS");
for (const name of ["DENTAIA_E2E_SENTINEL", "OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "DENTAIA_CLINICAL_SUPABASE_URL"]) {
  assert.equal(process.env[name], undefined, `${name} leaked to Next.js`);
}
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, fixtures.supabaseUrl);
assert.throws(() => net.connect({ host: "example.invalid", port: 443 }), /E2E_NETWORK_BLOCKED/);
assert.throws(() => tls.connect({ host: "example.invalid", port: 443 }), /E2E_NETWORK_BLOCKED/);
assert.throws(() => dns.lookup("example.invalid", () => {}), /E2E_NETWORK_BLOCKED/);
assert.throws(() => dgram.createSocket("udp4").send(Buffer.from("x"), 53, "example.invalid"), /E2E_NETWORK_BLOCKED/);
assert.throws(() => fetch("https://example.invalid/"), /E2E_NETWORK_BLOCKED/);
require("./network-guard.cjs").assertLocal("127.0.0.1");
console.log("E2E isolation preflight passed: sanitized environment and outbound sockets blocked");
