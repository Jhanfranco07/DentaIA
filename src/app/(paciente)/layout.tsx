import PortalShell from "@/components/PortalShell";

const enlaces = [
  { href: "/panel", etiqueta: "Mi panel" },
  { href: "/cuenta", etiqueta: "Mi perfil" },
  { href: "/fotografias", etiqueta: "Mis fotografías" },
  { href: "/analisis/demo", etiqueta: "Análisis educativo" },
  { href: "/solicitudes", etiqueta: "Mis solicitudes" },
  { href: "/directorio", etiqueta: "Odontólogos" },
];

export default function PortalPacienteLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell area="Paciente" descripcion="Tu espacio personal" enlaces={enlaces}>{children}</PortalShell>;
}
