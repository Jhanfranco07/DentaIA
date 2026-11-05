import PortalShell from "@/components/PortalShell";

const enlaces = [
  { href: "/profesional", etiqueta: "Panel profesional", exacto: true },
  { href: "/profesional#contexto-clinico", etiqueta: "Mi clínica" },
  { href: "/profesional#solicitudes-profesionales", etiqueta: "Solicitudes" },
  { href: "/profesional#historial-clinico", etiqueta: "Pacientes e historial" },
  { href: "/cuenta", etiqueta: "Mi cuenta" },
];

export default function PortalOdontologoLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell area="Odontología" descripcion="Espacio profesional" enlaces={enlaces}>{children}</PortalShell>;
}
