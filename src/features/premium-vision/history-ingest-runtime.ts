/** Separate fail-closed switch for DI-214 writes; historical reads remain independent. */
export function premiumHistoryIngestRuntime(env: NodeJS.ProcessEnv):
  | { enabled: true; hmacHex: string }
  | { enabled: false } {
  if (env.DENTAIA_PREMIUM_INGEST_ENABLED !== "true") return { enabled: false };
  if ((env.NODE_ENV === "production" || env.VERCEL_ENV === "production")
    && env.DENTAIA_PREMIUM_INGEST_PRODUCTION_ENABLED !== "true") return { enabled: false };
  const secret = env.DENTAIA_PREMIUM_INGEST_HMAC_HEX;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return { enabled: false };
  return { enabled: true, hmacHex: secret };
}
