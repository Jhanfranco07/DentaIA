import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DentaIA | Validación local de lectura", robots: { index: false, follow: false } };
export default async function ValidacionLecturaLocal() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { default: ValidacionLecturaAdmin } = await import("@/features/administracion/ValidacionLecturaAdmin");
  return <ValidacionLecturaAdmin />;
}
