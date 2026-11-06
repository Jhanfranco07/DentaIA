import type { User } from "@supabase/supabase-js";

export const ROLES_MODULO = ["paciente", "odontologo", "superusuario"] as const;
export type RolModulo = typeof ROLES_MODULO[number];

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Lee solo la asignación privada de Auth; user_metadata nunca concede módulos. */
export function rolesDesdeAppMetadata(metadata: unknown): RolModulo[] {
  if (!objeto(metadata) || !objeto(metadata.dentaia)) return [];
  const asignacion = metadata.dentaia;
  if (asignacion.version !== 1 || asignacion.estado !== "activo" || !Array.isArray(asignacion.roles)
    || asignacion.roles.length === 0 || asignacion.roles.length > ROLES_MODULO.length
    || !asignacion.roles.every((rol): rol is RolModulo => ROLES_MODULO.includes(rol as RolModulo))
    || new Set(asignacion.roles).size !== asignacion.roles.length) return [];
  return [...asignacion.roles];
}

/** Regla de destino, no jerarquía de permisos: el módulo debe autorizar cada operación aparte. */
export function rutaPrincipalPorRoles(roles: readonly RolModulo[]): string | null {
  if (roles.includes("superusuario")) return "/administracion";
  if (roles.includes("odontologo")) return "/profesional";
  if (roles.includes("paciente")) return "/panel";
  return null;
}

export function puedeAccederModulo(roles: readonly RolModulo[], permitidos: readonly RolModulo[]): boolean {
  return roles.some(rol => permitidos.includes(rol));
}

export function rolesDelUsuario(usuario: Pick<User, "app_metadata"> | null): RolModulo[] {
  return rolesDesdeAppMetadata(usuario?.app_metadata);
}
