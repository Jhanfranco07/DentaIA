import type { EnlacePortal } from "./PortalShell";

// Configuración de presentación compartida; la autorización permanece en cada módulo/API.
export const NAVEGACION_PACIENTE: readonly EnlacePortal[] = [
  { href: "/panel", etiqueta: "Mi panel", exacto: true, icono: "casa", grupo: "Mi espacio" },
  { href: "/analisis", etiqueta: "Preparar fotografía", icono: "destello", grupo: "Mi espacio" },
  { href: "/fotografias", etiqueta: "Mis fotografías", icono: "camara", grupo: "Mi espacio" },
  { href: "/resultados", etiqueta: "Mis resultados", icono: "reporte", grupo: "Mi espacio" },
  { href: "/solicitudes", etiqueta: "Mis solicitudes", icono: "calendario", grupo: "Mi espacio" },
  { href: "/buenas-practicas", etiqueta: "Buenas prácticas", icono: "escudo", grupo: "Mi espacio" },
  { href: "/directorio", etiqueta: "Odontólogos", icono: "diente", grupo: "Explorar" },
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
