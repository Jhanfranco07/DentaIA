type Env = Record<string, string | undefined>;

/** Disponibilidad de la ruta, no autorización: cada API conserva su guard de rol y AAL2. */
export function panelAdministrativoDisponible(env: Env): boolean {
  const local = env.NODE_ENV === "development" && !env.VERCEL && !env.VERCEL_ENV;
  const preview = env.VERCEL === "1" && env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === "develop" && env.DENTAIA_ADMIN_PREVIEW_ENABLED === "true";
  const production = env.NODE_ENV === "production" && env.VERCEL === "1"
    && env.VERCEL_ENV === "production" && env.VERCEL_GIT_COMMIT_REF === "main";
  return local || preview || production;
}

/** Lecturas en un despliegue admitido, siempre con opt-in; el adaptador exige credencial privada. */
export function lecturasAdministrativasDisponibles(env: Env): boolean {
  return env.DENTAIA_ADMIN_READS_ENABLED === "true" && panelAdministrativoDisponible(env);
}
