"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { mensajeError } from "./validaciones";

export function useSesion() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorSesion, setErrorSesion] = useState("");
  const activo = useRef(false);
  const peticion = useRef(0);
  const idValidado = useRef<string | null>(null);

  const verificar = useCallback(async () => {
    const version = ++peticion.current;
    if (!activo.current) return;
    setCargando(true); setUsuario(null); setErrorSesion(""); idValidado.current = null;
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getUser();
      if (!activo.current || version !== peticion.current) return;
      if (error && error.name !== "AuthSessionMissingError") throw error;
      setUsuario(data.user); idValidado.current = data.user?.id ?? null;
    } catch (error) {
      if (activo.current && version === peticion.current) setErrorSesion(mensajeError(error));
    } finally { if (activo.current && version === peticion.current) setCargando(false); }
  }, []);

  useEffect(() => {
    activo.current = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let desuscribir: (() => void) | undefined;
    try {
      const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((evento, session) => {
        if (!activo.current || evento === "INITIAL_SESSION") return;
        if (!session) {
          ++peticion.current; idValidado.current = null;
          setUsuario(null); setCargando(false); setErrorSesion("");
          if (temporizador) clearTimeout(temporizador);
          return;
        }
        // Un refresco de la misma identidad no debe borrar una edición en curso.
        if ((evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN") && session.user.id === idValidado.current) return;
        ++peticion.current; idValidado.current = null; setUsuario(null); setCargando(true);
        if (temporizador) clearTimeout(temporizador);
        // No invocar métodos Auth dentro de su callback (bloqueo del SDK).
        temporizador = setTimeout(() => { void verificar(); }, 0);
      });
      desuscribir = () => subscription.unsubscribe();
    } catch { /* verificar informa el error de configuración de forma segura. */ }
    void verificar();
    return () => {
      activo.current = false; ++peticion.current;
      if (temporizador) clearTimeout(temporizador);
      desuscribir?.();
    };
  }, [verificar]);

  return { usuario, cargando, errorSesion, verificar };
}
