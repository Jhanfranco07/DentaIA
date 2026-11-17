export const SUBSCRIPTION_QA_BRANCH = "integration/pr71-pr74-compat-20261117";

/** Stripe subscriptions remain test-only. Production requires explicit opt-in. */
export function suscripcionesSandboxHabilitadas(env: Record<string, string | undefined>): boolean {
  const previewQa = env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === SUBSCRIPTION_QA_BRANCH
    && env.DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED === "true";

  const productionSandbox = env.VERCEL_ENV === "production"
    && env.DENTAIA_STRIPE_SANDBOX_PRODUCTION_ENABLED === "true"
    && env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true;

  return previewQa || productionSandbox;
}
