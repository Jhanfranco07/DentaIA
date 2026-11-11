import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DentaIA | Preparación MFA local", robots: { index: false, follow: false } };

export default async function MfaAdministrativaLocal() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { default: MfaAdminLocal } = await import("@/features/administracion/MfaAdminLocal");
  // Bandera de prevención de acciones accidentales; no sustituye permisos de Supabase ni el guard AAL2.
  return <MfaAdminLocal permitirOperaciones={process.env.DENTAIA_QA_MFA_ENABLED === "true"} />;
}
