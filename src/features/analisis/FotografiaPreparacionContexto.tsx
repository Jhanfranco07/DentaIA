"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ContextoFotografia = {
  fotografia: File | null;
  establecerFotografia(fotografia: File): void;
  limpiarFotografia(): void;
};

const Contexto = createContext<ContextoFotografia | null>(null);

export function FotografiaPreparacionProvider({ children }: { children: ReactNode }) {
  const [fotografia, setFotografia] = useState<File | null>(null);
  const establecerFotografia = useCallback((archivo: File) => setFotografia(archivo), []);
  const limpiarFotografia = useCallback(() => setFotografia(null), []);
  const value = useMemo(() => ({ fotografia, establecerFotografia, limpiarFotografia }), [fotografia, establecerFotografia, limpiarFotografia]);
  return <Contexto.Provider value={value}>{children}</Contexto.Provider>;
}

export function useFotografiaPreparacion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("La preparación de fotografías requiere FotografiaPreparacionProvider.");
  return contexto;
}
