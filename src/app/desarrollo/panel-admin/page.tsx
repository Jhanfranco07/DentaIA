import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "DentaIA | Diseño administrativo local",
  robots: { index: false, follow: false },
};

export default async function DisenoAdministrativoPage() {
  // Restricción de entorno, NO autorización: DI-150 implementará el acceso administrativo real.
  // También bloquea Preview y next start; no aceptar parámetros de URL para habilitar la vista.
  if (process.env.NODE_ENV !== "development") notFound();

  const { default: PanelAdministrativoDemo } = await import("@/features/administracion/PanelAdministrativoDemo");
  return <PanelAdministrativoDemo />;
}
