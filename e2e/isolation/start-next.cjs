"use strict";

const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const fixtures = require("./fixtures.json");

const root = resolve(__dirname, "../..");
for (const name of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local"]) {
  if (existsSync(resolve(root, name))) throw new Error(`E2E refuses local environment file: ${name}`);
}

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid E2E port");
const mode = process.argv[3];
if (mode && !["--verify", "--build", "--unit"].includes(mode)) throw new Error("Invalid isolation mode");

// Construct an allowlist, never copy the parent process environment wholesale.
const env = {};
for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "COMSPEC", "PATHEXT", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"]) {
  if (process.env[name]) env[name] = process.env[name];
}
Object.assign(env, {
  NODE_ENV: mode === "--build" ? "production" : mode === "--unit" ? "test" : "development",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
  NEXT_PUBLIC_SUPABASE_URL: fixtures.supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixtures.supabasePublishableKey,
  DENTAIA_E2E_NETWORK_GUARD: "1",
  DENTAIA_SMILE_API_URL: "http://127.0.0.1:1/analyze",
  DENTAIA_SMILE_PREVIEW_ENABLED: "false",
  DENTAIA_SMILE_PRODUCTION_ENABLED: "false",
  DENTAIA_CLINICAL_HTTP_ENABLED: "false",
  DENTAIA_CLINICAL_PREVIEW_ENABLED: "false",
  DENTAIA_CLINICAL_PRODUCTION_ENABLED: "false",
  DENTAIA_CLINICAL_ACADEMIC_ENABLED: "false",
  DENTAIA_ADMIN_READS_ENABLED: "false",
  DENTAIA_ADMIN_PREVIEW_ENABLED: "false",
  DENTAIA_ADMIN_WORKFLOWS_ENABLED: "false",
  DENTAIA_ROLE_WRITES_ENABLED: "false",
  DENTAIA_LOCATION_WRITES_ENABLED: "false",
  DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED: "false",
  DENTAIA_STRIPE_SANDBOX_PRODUCTION_ENABLED: "false",
  DENTAIA_SEGUIMIENTO_RUTINAS_HABILITADO: "false",
  NEXT_PUBLIC_DENTAIA_SEGUIMIENTO_RUTINAS: "false",
});
const guard = resolve(__dirname, "network-guard.cjs");
if (guard.includes('"')) throw new Error("E2E guard path contains an unsupported quote");
env.NODE_OPTIONS = `--require="${guard.replace(/\\/g, "/")}"`;
const probe = spawnSync(process.execPath, [resolve(__dirname, "probe.cjs")], {
  cwd: root, env, encoding: "utf8", windowsHide: true,
});
if (probe.status !== 0) throw new Error(`E2E network isolation preflight failed: ${probe.stderr || probe.error?.message || probe.status}`);
console.log(probe.stdout.trim());
if (mode === "--verify") process.exit(0);
if (process.env.DENTAIA_E2E_AUDIT_FILE) env.DENTAIA_E2E_AUDIT_FILE = process.env.DENTAIA_E2E_AUDIT_FILE;
if (process.env.DENTAIA_E2E_OWNER_FILE) env.DENTAIA_E2E_OWNER_FILE = process.env.DENTAIA_E2E_OWNER_FILE;
env.DENTAIA_E2E_PORT = String(port);
const entry = mode === "--unit" ? resolve(root, "node_modules/vitest/vitest.mjs") : resolve(root, "node_modules/next/dist/bin/next");
if (!existsSync(entry)) throw new Error("Required validation dependency is not installed in this worktree");
for (const name of Object.keys(process.env)) delete process.env[name];
Object.assign(process.env, env);
require(guard);
process.argv = mode === "--unit" ? [process.execPath, entry, "run"] :
  mode === "--build" ? [process.execPath, entry, "build"] :
  [process.execPath, entry, "dev", "--hostname", "127.0.0.1", "--port", String(port)];
if (mode === "--unit") import(require("node:url").pathToFileURL(entry).href);
else require(entry);
