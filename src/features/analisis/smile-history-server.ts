import "server-only";

import { createUserScopedSupabaseClient } from "@/lib/supabase/request.server";
import type { Tables } from "@/lib/supabase/database.types";

export type SmileAnalysisHistory = Tables<"smile_analyses">;
export type SmileAccessGrant = Tables<"smile_analysis_access_grants">;

/** Server-only adapter; RLS restricts reads to the patient or an active grant. */
export async function listMySmileAnalyses(accessToken: string) {
  const { data, error } = await createUserScopedSupabaseClient(accessToken)
    .from("smile_analyses")
    .select("*")
    .order("analyzed_at", { ascending: false });
  if (error) throw new Error("No se pudo consultar el historial Smile.", { cause: error });
  return data;
}

export async function acceptSmileStorageConsent(accessToken: string, consentVersion: string) {
  const version = consentVersion.trim();
  if (!version || version.length > 80) throw new Error("Versión de consentimiento no válida.");
  const { data, error } = await createUserScopedSupabaseClient(accessToken)
    .from("smile_analysis_consents")
    .insert({ consent_version: version })
    .select("*")
    .single();
  if (error) throw new Error("No se pudo registrar el consentimiento Smile.", { cause: error });
  return data;
}

export async function revokeSmileAnalysisConsent(accessToken: string, consentId: string) {
  const { error } = await createUserScopedSupabaseClient(accessToken)
    .rpc("revoke_smile_analysis_consent", { p_consent_id: consentId });
  if (error) throw new Error("No se pudo revocar el consentimiento Smile.", { cause: error });
}

export async function grantSmileAnalysisAccess(
  accessToken: string,
  analysisId: string,
  professionalId: string,
  expiresAt: string,
) {
  const { data, error } = await createUserScopedSupabaseClient(accessToken).rpc("grant_smile_analysis_access", {
    p_analysis_id: analysisId,
    p_professional_id: professionalId,
    p_expires_at: expiresAt,
  });
  if (error) throw new Error("No se pudo conceder el acceso al análisis.", { cause: error });
  if (typeof data !== "string") throw new Error("La respuesta al conceder acceso Smile no es válida.");
  return data;
}

export async function revokeSmileAnalysisAccess(accessToken: string, grantId: string) {
  const { error } = await createUserScopedSupabaseClient(accessToken)
    .rpc("revoke_smile_analysis_access", { p_grant_id: grantId });
  if (error) throw new Error("No se pudo revocar el acceso al análisis.", { cause: error });
}
