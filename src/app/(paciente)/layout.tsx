import PortalShell, { type EnlacePortal } from "@/components/PortalShell";

const enlaces: readonly EnlacePortal[] = [
  { href: "/panel", etiqueta: "Resumen", icono: "casa", exacto: true, grupo: "Mi espacio" },
  { href: "/cuenta", etiqueta: "Mi perfil", icono: "persona", grupo: "Mi espacio" },
  { href: "/fotografias", etiqueta: "Fotografías", icono: "camara", grupo: "Mi espacio" },
  { href: "/solicitudes", etiqueta: "Solicitudes", icono: "calendario", grupo: "Mi espacio" },
  { href: "/analisis/demo", etiqueta: "Análisis educativo", icono: "reporte", grupo: "Explorar" },
  { href: "/directorio", etiqueta: "Odontólogos", icono: "diente", grupo: "Explorar" },
];

export default function PortalPacienteLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell area="Paciente" descripcion="Tu espacio personal" enlaces={enlaces}>{children}</PortalShell>;
}
