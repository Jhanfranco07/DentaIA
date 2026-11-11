import { NAVEGACION_PACIENTE } from "@/components/navegacion-portal";
import PortalShell from "@/components/PortalShell";
import { FotografiaPreparacionProvider } from "@/features/analisis/FotografiaPreparacionContexto";

export default function PortalPacienteLayout({ children }: { children: React.ReactNode }) {
  return <FotografiaPreparacionProvider><PortalShell area="Paciente" descripcion="Tu espacio personal" enlaces={NAVEGACION_PACIENTE} mostrarCuentaHeader={false}>{children}</PortalShell></FotografiaPreparacionProvider>;
}
