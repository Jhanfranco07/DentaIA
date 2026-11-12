import { rutaPrincipalPorRoles, type RolModulo } from "../autorizacion/roles.ts";

/**
 * Al abrir la página de acceso con una sesión de paciente ya activa,
 * entra al panel. El perfil permanece accesible mediante ?perfil=1.
 * El retorno de solicitudes debe venir de retornoSolicitud (URL validada).
 */
export function destinoEntradaPaciente(
  roles: readonly RolModulo[],
  perfilSolicitado: boolean,
  continuarValidado: string | null,
): string | null {
  if (perfilSolicitado || roles.length !== 1 || roles[0] !== "paciente") return null;
  return continuarValidado ?? rutaPrincipalPorRoles(roles);
}
