export type EntornoFlujosAdmin = {
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  DENTAIA_ADMIN_WORKFLOWS_ENABLED?: string;
};

/** Opt-in local o solo Preview asociado a develop; Production siempre queda cerrado. */
export function flujosAdministrativosHabilitados(env: EntornoFlujosAdmin): boolean {
  const local = env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV;
  const preview = env.VERCEL === "1" && env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === "develop";
  return env.DENTAIA_ADMIN_WORKFLOWS_ENABLED === "true" && (local || preview);
}
