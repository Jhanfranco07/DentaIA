"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CLAVE_TEMA, guardarTema, leerTema, temaDesdeEvento, type Tema } from "@/lib/tema/preferencia";

const ContextoTema = createContext<{ tema: Tema; alternar: () => void } | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("claro");
  const ruta = usePathname();
  useEffect(() => {
    try { setTema(leerTema(window.localStorage)); } catch { /* Modo claro por defecto. */ }
    const sincronizar = (evento: StorageEvent) => {
      if (evento.key === CLAVE_TEMA || evento.key === null) setTema(temaDesdeEvento(evento.newValue));
    };
    window.addEventListener("storage", sincronizar);
    return () => window.removeEventListener("storage", sincronizar);
  }, []);
  // La portada usa siempre el contraste claro sin alterar la preferencia guardada.
  // Al salir, los módulos recuperan inmediatamente el tema elegido por el usuario.
  useEffect(() => { document.documentElement.dataset.tema = ruta === "/" ? "claro" : tema; }, [tema, ruta]);

  function alternar() {
    const siguiente = tema === "claro" ? "oscuro" : "claro";
    setTema(siguiente);
    try { guardarTema(window.localStorage, siguiente); } catch { /* Preferencia opcional. */ }
  }

  return <ContextoTema.Provider value={{ tema, alternar }}>{children}<div className="tema-flotante"><TemaBoton /></div></ContextoTema.Provider>;
}

export function useTema() {
  const contexto = useContext(ContextoTema);
  if (!contexto) throw new Error("El selector de tema necesita TemaProvider.");
  return contexto;
}

export function TemaBoton({ className = "", cabecera = false }: { className?: string; cabecera?: boolean }) {
  const { tema, alternar } = useTema();
  return <button type="button" className={`tema-selector ${className}`} data-control-tema={cabecera ? "cabecera" : undefined} onClick={alternar}
    aria-pressed={tema === "oscuro"} aria-label={tema === "oscuro" ? "Activar modo claro" : "Activar modo oscuro"}>
    <span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span><span>{tema === "oscuro" ? "Claro" : "Oscuro"}</span>
  </button>;
}
