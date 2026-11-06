// Contrato de presentación. No contiene roles autenticados ni permisos efectivos.
export const SECCIONES_ADMINISTRATIVAS = [
  { id: "inicio", titulo: "Inicio", descripcion: "Resumen del espacio administrativo", icono: "reporte" },
  { id: "usuarios", titulo: "Usuarios", descripcion: "Estructura de gestión de cuentas", icono: "persona" },
  { id: "roles", titulo: "Roles y permisos", descripcion: "Alcances previstos para cada perfil", icono: "escudo" },
  { id: "ubicaciones", titulo: "Consultorios", descripcion: "Ubicaciones odontológicas verificadas", icono: "clinica" },
  { id: "vinculaciones", titulo: "Odontólogos y clínicas", descripcion: "Membresías profesionales verificadas", icono: "persona" },
  { id: "resenas", titulo: "Reseñas y reportes", descripcion: "Moderación de contenido verificable", icono: "reporte" },
] as const;

export type SeccionAdministrativa = typeof SECCIONES_ADMINISTRATIVAS[number]["id"];

export type NavegacionAdministrativaProps = {
  seccion: SeccionAdministrativa;
  onSeleccionar: (seccion: SeccionAdministrativa) => void;
};
