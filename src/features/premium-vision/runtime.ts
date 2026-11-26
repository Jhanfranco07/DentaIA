export type RfdetrRuntime =
  | { enabled: true; target: URL; serviceSecret: string }
  | { enabled: false; reason: "disabled" | "production_disabled" | "secret_missing" | "target_invalid" };

/** Two explicit flags are needed before production can reach the independent service. */
export function rfdetrRuntime(env: NodeJS.ProcessEnv): RfdetrRuntime {
  if (env.DENTAIA_RFDETR_ENABLED !== "true") return { enabled: false, reason: "disabled" };
  if ((env.NODE_ENV === "production" || env.VERCEL_ENV === "production")
    && env.DENTAIA_RFDETR_PRODUCTION_ENABLED !== "true") {
    return { enabled: false, reason: "production_disabled" };
  }
  const secret = env.DENTAIA_RFDETR_SERVICE_SECRET;
  if (!secret || secret.length < 32) return { enabled: false, reason: "secret_missing" };
  try {
    const target = new URL(env.DENTAIA_RFDETR_API_URL ?? "");
    const local = env.NODE_ENV === "development" && target.protocol === "http:"
      && ["127.0.0.1", "localhost"].includes(target.hostname);
    if ((!local && target.protocol !== "https:") || target.username || target.password
      || target.search || target.hash || target.pathname !== "/analyze") {
      return { enabled: false, reason: "target_invalid" };
    }
    return { enabled: true, target, serviceSecret: secret };
  } catch {
    return { enabled: false, reason: "target_invalid" };
  }
}
