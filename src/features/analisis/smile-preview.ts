export const SMILE_PREVIEW_BRANCH = "feature/integracion-ia-premium";
const LOCAL_API = "http://127.0.0.1:7862/analyze";
const SERVICE_SECRET_MIN_LENGTH = 32;

export type SmileEnablementCheck =
  | "environment_missing_or_not_preview"
  | "branch_missing_or_not_allowed"
  | "preview_flag_missing_or_disabled"
  | "service_secret_missing_or_too_short"
  | "upstream_missing_or_invalid";

export type SmileRuntime =
  | { enabled: true; target: URL; serviceSecret?: string }
  | { enabled: false; failedChecks: readonly SmileEnablementCheck[] };

function httpsTarget(value: string | undefined): URL | null {
  try {
    const target = new URL(value ?? "");
    return target.protocol === "https:" && !target.username && !target.password && !target.search && !target.hash ? target : null;
  } catch {
    return null;
  }
}

/** Server-only gate for Smile's local workflow and the explicitly scoped Vercel Preview. */
export function smileRuntime(env: NodeJS.ProcessEnv): SmileRuntime {
  if (env.NODE_ENV === "development") {
    try {
      return { enabled: true, target: new URL(env.DENTAIA_SMILE_API_URL || LOCAL_API) };
    } catch {
      return { enabled: false, failedChecks: ["upstream_missing_or_invalid"] };
    }
  }

  const failedChecks: SmileEnablementCheck[] = [];
  if (env.VERCEL_ENV !== "preview") failedChecks.push("environment_missing_or_not_preview");
  if (env.VERCEL_GIT_COMMIT_REF !== SMILE_PREVIEW_BRANCH) failedChecks.push("branch_missing_or_not_allowed");
  if (env.DENTAIA_SMILE_PREVIEW_ENABLED !== "true") failedChecks.push("preview_flag_missing_or_disabled");
  const serviceSecret = env.DENTAIA_SMILE_SERVICE_SECRET;
  if (!serviceSecret || serviceSecret.length < SERVICE_SECRET_MIN_LENGTH) failedChecks.push("service_secret_missing_or_too_short");
  const target = httpsTarget(env.DENTAIA_SMILE_API_URL);
  if (!target) failedChecks.push("upstream_missing_or_invalid");

  return failedChecks.length ? { enabled: false, failedChecks } : { enabled: true, target: target!, serviceSecret };
}
