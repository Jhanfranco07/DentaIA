import { notFound } from "next/navigation";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DentaIA | QA local de roles", robots: { index: false, follow: false } };
export default async function RolesAdminLocal() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { default: CambioRolesLocal } = await import("@/features/administracion/CambioRolesLocal");
  return <CambioRolesLocal />;
}
