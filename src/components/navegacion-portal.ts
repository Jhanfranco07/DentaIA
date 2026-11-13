import type { EnlacePortal } from "./PortalShell";

// Configuración de presentación compartida; la autorización permanece en cada módulo/API.
export const NAVEGACION_PACIENTE: readonly EnlacePortal[] = [
  { href: "/panel", etiqueta: "Mi panel", exacto: true, icono: "casa", grupo: "Principal" },
  { href: "/analisis", etiqueta: "Preparar fotografía", icono: "camara", grupo: "Mi cuidado dental" },
  { href: "/fotografias", etiqueta: "Mis fotografías", icono: "imagen", grupo: "Mi cuidado dental" },
  { href: "/resultados", etiqueta: "Mis resultados", icono: "reporte", grupo: "Mi cuidado dental" },
  { href: "/solicitudes", etiqueta: "Mis solicitudes", icono: "calendario", grupo: "Mi cuidado dental" },
  { href: "/buenas-practicas", etiqueta: "Buenas prácticas", icono: "escudo", grupo: "Recursos" },
  { href: "/panel/odontologos", etiqueta: "Odontólogos", icono: "usuarios", grupo: "Recursos" },
  { href: "/cuenta", etiqueta: "Mi perfil", icono: "persona", grupo: "Cuenta" },
];
export const NAVEGACION_ODONTOLOGO: readonly EnlacePortal[] = [
  { href: "/profesional", etiqueta: "Resumen profesional", exacto: true, icono: "casa", grupo: "Clínica" },
  { href: "/profesional#contexto-clinico", etiqueta: "Mi clínica", icono: "clinica", grupo: "Clínica" },
  { href: "/profesional#solicitudes-profesionales", etiqueta: "Solicitudes de demostración", icono: "calendario", grupo: "Atención" },
  { href: "/profesional#historial-clinico", etiqueta: "Pacientes e historial", icono: "usuarios", grupo: "Atención" },
  { href: "/profesional#perfil-profesional", etiqueta: "Perfil profesional", icono: "persona", grupo: "Cuenta" },
  { href: "/cuenta", etiqueta: "Mi cuenta", icono: "persona", grupo: "Cuenta" },
];
export const NAVEGACION_ADMIN: readonly EnlacePortal[] = [
  { href: "/administracion", etiqueta: "Panel administrativo", exacto: true, icono: "casa", grupo: "Administración" },
  { href: "/cuenta", etiqueta: "Mi cuenta", icono: "persona", grupo: "Cuenta" },
];
