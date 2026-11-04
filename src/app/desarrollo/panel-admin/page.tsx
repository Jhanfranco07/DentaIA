import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "DentaIA | Panel administrativo local",
  robots: { index: false, follow: false },
};

export default async function DisenoAdministrativoPage() {
  // El entorno restringe la ruta; DI-150 verifica el acceso y cada API por separado.
  // También bloquea Preview y next start; no aceptar parámetros de URL para habilitar la vista.
  if (process.env.NODE_ENV !== "development") notFound();

  const [{ default: PanelAdministrativoDemo }, { default: AccesoAdministrativo }] = await Promise.all([
    import("@/features/administracion/PanelAdministrativoDemo"), import("@/features/administracion/UsuariosAdministrativosConectados"),
  ]);
  return <AccesoAdministrativo><PanelAdministrativoDemo /></AccesoAdministrativo>;
}
