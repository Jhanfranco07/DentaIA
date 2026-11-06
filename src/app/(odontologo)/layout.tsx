import PortalShell, { type EnlacePortal } from "@/components/PortalShell";

const enlaces: readonly EnlacePortal[] = [
  { href: "/profesional", etiqueta: "Resumen profesional", exacto: true, icono: "casa", grupo: "Clínica" },
  { href: "/profesional#contexto-clinico", etiqueta: "Mi clínica", icono: "clinica", grupo: "Clínica" },
  { href: "/profesional#solicitudes-profesionales", etiqueta: "Solicitudes", icono: "calendario", grupo: "Atención" },
  { href: "/profesional#historial-clinico", etiqueta: "Pacientes e historial", icono: "usuarios", grupo: "Atención" },
  { href: "/cuenta", etiqueta: "Mi cuenta", icono: "persona", grupo: "Cuenta" },
];

export default function PortalOdontologoLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell area="Odontología" descripcion="Espacio profesional" enlaces={enlaces}>{children}</PortalShell>;
}
