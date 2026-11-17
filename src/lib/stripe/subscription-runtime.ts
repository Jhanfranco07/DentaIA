export const SUBSCRIPTION_QA_BRANCH = "integration/pr71-pr74-compat-20261117";

export function suscripcionesSandboxHabilitadas(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === SUBSCRIPTION_QA_BRANCH
    && env.DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED === "true";
}
