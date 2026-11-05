"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { puedeAccederModulo, rolesDelUsuario, type RolModulo } from "./roles";
import { useSesion } from "@/features/cuenta/useSesion";

export default function AccesoRol({ rolesRequeridos, children, modulo }: {
  rolesRequeridos: readonly RolModulo[];
  children: ReactNode;
  modulo: string;
}) {
  const { usuario, cargando, errorSesion, verificar } = useSesion();
  const roles = rolesDelUsuario(usuario);

  if (cargando) return <main><p role="status">Comprobando tu sesión y permisos…</p></main>;
  if (errorSesion) return <main><h1>No pudimos validar la sesión</h1><p role="alert">{errorSesion}</p>
    <button type="button" onClick={() => { void verificar(); }}>Volver a comprobar</button></main>;
  if (!usuario) return <main><h1>Inicia sesión para continuar</h1><p>Esta sección requiere una cuenta autorizada.</p>
    <Link href="/cuenta">Ir a Mi cuenta</Link></main>;
  if (!puedeAccederModulo(roles, rolesRequeridos)) return <main><h1>Acceso restringido</h1>
    <p>Tu cuenta no tiene el rol necesario para abrir {modulo}. Cambiar la dirección no concede acceso.</p>
    <Link href="/cuenta">Volver a Mi cuenta</Link></main>;
  return children;
}
