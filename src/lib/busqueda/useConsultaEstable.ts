"use client";

import { useEffect, useState } from "react";

export function useConsultaEstable(texto: string) {
  const consulta = texto.trim();
  const [estable, setEstable] = useState(consulta);
  useEffect(() => {
    if (!consulta) {
      setEstable("");
      return;
    }
    const temporizador = window.setTimeout(() => setEstable(consulta), 280);
    return () => window.clearTimeout(temporizador);
  }, [consulta]);
  return !consulta || consulta === estable ? consulta : undefined;
}
