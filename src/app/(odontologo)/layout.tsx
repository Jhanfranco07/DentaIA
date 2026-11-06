import { NAVEGACION_ODONTOLOGO } from "@/components/navegacion-portal";
import PortalShell from "@/components/PortalShell";

export default function PortalOdontologoLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell area="Odontología" descripcion="Espacio profesional" enlaces={NAVEGACION_ODONTOLOGO}>{children}</PortalShell>;
}
