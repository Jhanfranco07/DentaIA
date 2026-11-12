"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { leerPerfil } from "./perfiles";

export const EVENTO_NOMBRE_PERFIL = "dentai:nombre-perfil-actualizado";

export function nombreVisible(perfil: string | null, usuario: Pick<User, "user_metadata" | "email"> | null): string {
  const guardado = perfil?.trim();
  if (guardado) return guardado;
  const inicial = usuario?.user_metadata?.full_name;
  if (typeof inicial === "string" && inicial.trim()) return inicial.trim();
  return usuario?.email?.split("@")[0] ?? "Cuenta";
}

/**
 * El nombre mostrado es un dato de presentación, no se utiliza para autorizar.
 * La tabla profiles es la fuente principal; los metadatos Auth son solo fallback.
 */
export function useNombrePerfil(usuario: User | null) {
  const id = usuario?.id ?? null;
  const [perfil, setPerfil] = useState<{ id: string; nombre: string | null } | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!id) return;
    async function cargar() {
      try {
        const actual = await leerPerfil(getSupabaseBrowserClient(), id!);
        if (vigente) setPerfil({ id: id!, nombre: actual?.full_name ?? null });
      } catch {
        // No bloquear el panel por un error de lectura: mostrar fallback Auth.
        if (vigente) setPerfil({ id: id!, nombre: null });
      }
    }
    const actualizar = (evento: Event) => {
      const detalle = (evento as CustomEvent<{ usuarioId: string; nombre: string }>).detail;
      if (detalle?.usuarioId !== id || typeof detalle.nombre !== "string") return;
      setPerfil({ id: id!, nombre: detalle.nombre });
    };
    void cargar();
    window.addEventListener(EVENTO_NOMBRE_PERFIL, actualizar);
    return () => { vigente = false; window.removeEventListener(EVENTO_NOMBRE_PERFIL, actualizar); };
  }, [id]);

  return nombreVisible(perfil?.id === id ? perfil.nombre : null, usuario);
}
