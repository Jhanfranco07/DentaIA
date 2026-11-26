import assert from "node:assert/strict";
import test from "node:test";
import { premiumHistoryIngestRuntime } from "./history-ingest-runtime.ts";

const configured = { DENTAIA_PREMIUM_INGEST_ENABLED: "true",
  DENTAIA_PREMIUM_INGEST_HMAC_HEX: "a".repeat(64) };

test("DI-214 ingestion stays off even when HMAC is provisioned", () => {
  assert.equal(premiumHistoryIngestRuntime({ DENTAIA_PREMIUM_INGEST_HMAC_HEX: configured.DENTAIA_PREMIUM_INGEST_HMAC_HEX }).enabled, false);
  assert.equal(premiumHistoryIngestRuntime({ ...configured, DENTAIA_PREMIUM_INGEST_HMAC_HEX: "invalid" }).enabled, false);
});

test("DI-214 ingestion requires a second production switch", () => {
  assert.equal(premiumHistoryIngestRuntime({ ...configured, NODE_ENV: "production" }).enabled, false);
  assert.equal(premiumHistoryIngestRuntime({ ...configured, VERCEL_ENV: "production" }).enabled, false);
  assert.equal(premiumHistoryIngestRuntime({ ...configured, NODE_ENV: "production",
    DENTAIA_PREMIUM_INGEST_PRODUCTION_ENABLED: "true" }).enabled, true);
});
