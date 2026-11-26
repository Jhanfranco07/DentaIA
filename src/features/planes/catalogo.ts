export const PLAN_FEATURES = {
  smile_yellow_teeth_basic: { minimumPlan: "basic", implemented: true },
  smile_analysis_history: { minimumPlan: "premium", implemented: false },
  smile_analysis_comparison: { minimumPlan: "premium", implemented: false },
  smile_share_with_dentist: { minimumPlan: "premium", implemented: false },
  smile_advanced_analysis: { minimumPlan: "premium", implemented: false },
  // Request-side runtime flags still keep inference disabled by default.
  premium_visual_evaluation: { minimumPlan: "premium", implemented: true },
} as const;

export type Plan = "basic" | "premium";
export type FeatureKey = keyof typeof PLAN_FEATURES;

/**
 * Pure policy layer. Callers must derive `plan` from a server-verified
 * subscription record; never from request parameters or user metadata.
 */
export function featureEnabled(plan: Plan, feature: FeatureKey) {
  const definition = PLAN_FEATURES[feature];
  return definition.implemented && (definition.minimumPlan === "basic" || plan === "premium");
}

export function effectivePlan(subscription: { status: string; current_period_end: string | null } | null, now = new Date()): Plan {
  if (!subscription || subscription.status !== "active" || !subscription.current_period_end) return "basic";
  return Date.parse(subscription.current_period_end) > now.getTime() ? "premium" : "basic";
}
