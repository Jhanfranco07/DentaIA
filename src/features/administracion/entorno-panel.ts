type Env = Record<string, string | undefined>;

/** Solo desarrollo local o Preview explícito de la rama académica develop. */
export function panelAdministrativoDisponible(env: Env): boolean {
  const local = env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV;
  const preview = env.VERCEL === "1" && env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === "develop" && env.DENTAIA_ADMIN_PREVIEW_ENABLED === "true";
  return local || preview;
}

/** La lectura Auth privilegiada queda limitada a desarrollo local o Preview académico de develop. */
export function lecturasAdministrativasDisponibles(env: Env): boolean {
  return env.DENTAIA_ADMIN_READS_ENABLED === "true" && panelAdministrativoDisponible(env);
}
