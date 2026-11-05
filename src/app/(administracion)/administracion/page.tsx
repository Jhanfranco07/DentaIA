import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { panelAdministrativoDisponible } from "@/features/administracion/entorno-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DentaIA | Administración", robots: { index: false, follow: false } };

export default async function AdministracionPage() {
  if (!panelAdministrativoDisponible(process.env)) notFound();
  const [{ default: PanelAdministrativoDemo }, { default: AccesoAdministrativo }] = await Promise.all([
    import("@/features/administracion/PanelAdministrativoDemo"),
    import("@/features/administracion/UsuariosAdministrativosConectados"),
  ]);
  return <AccesoAdministrativo><PanelAdministrativoDemo /></AccesoAdministrativo>;
}
