import PortalShell, { type EnlacePortal } from "@/components/PortalShell";
import { FotografiaPreparacionProvider } from "@/features/analisis/FotografiaPreparacionContexto";

const enlaces: readonly EnlacePortal[] = [
  { href: "/panel", etiqueta: "Inicio", icono: "casa", exacto: true, grupo: "Principal" },
  { href: "/analisis", etiqueta: "Análisis dental con IA", icono: "destello", grupo: "Principal" },
  { href: "/fotografias", etiqueta: "Mis fotografías", icono: "camara", grupo: "Principal" },
  { href: "/resultados", etiqueta: "Mis resultados", icono: "reporte", grupo: "Principal" },
  { href: "/solicitudes", etiqueta: "Mis solicitudes", icono: "calendario", grupo: "Principal" },
  { href: "/directorio", etiqueta: "Odontólogos", icono: "diente", grupo: "Explorar" },
  { href: "/cuenta", etiqueta: "Mi perfil", icono: "persona", grupo: "Cuenta" },
];

export default function PortalPacienteLayout({ children }: { children: React.ReactNode }) {
  return <FotografiaPreparacionProvider><PortalShell area="Paciente" descripcion="Tu espacio personal" enlaces={enlaces} mostrarCuentaHeader={false}>{children}</PortalShell></FotografiaPreparacionProvider>;
}
