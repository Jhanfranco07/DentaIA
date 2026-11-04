// Contrato de presentación. No contiene roles autenticados ni permisos efectivos.
export const SECCIONES_ADMINISTRATIVAS = [
  { id: "inicio", titulo: "Inicio", descripcion: "Resumen del espacio administrativo", icono: "reporte" },
  { id: "usuarios", titulo: "Usuarios", descripcion: "Estructura de gestión de cuentas", icono: "persona" },
  { id: "roles", titulo: "Roles y permisos", descripcion: "Alcances previstos para cada perfil", icono: "escudo" },
] as const;

export type SeccionAdministrativa = typeof SECCIONES_ADMINISTRATIVAS[number]["id"];

export type NavegacionAdministrativaProps = {
  seccion: SeccionAdministrativa;
  onSeleccionar: (seccion: SeccionAdministrativa) => void;
};
