export const ETAPAS = ["seleccion", "revision", "preparacion", "resultado", "recomendaciones", "reporte", "orientacion", "final"] as const;
export type EtapaDemo = typeof ETAPAS[number];
export const CLAVE_SESION_DEMO = "dentaia-demo-v2";
export type SesionDemo = { casoId: string; etapa: EtapaDemo; fechaISO: string };

// Solo se conserva la referencia a una muestra pública: nunca archivos, fotos privadas o datos de cuenta.
export function leerSesionDemo(texto: string | null, idsPermitidos: readonly string[]): SesionDemo | null {
  try {
    const dato: unknown = JSON.parse(texto ?? "null");
    if (!dato || typeof dato !== "object") return null;
    const { casoId, etapa, fechaISO } = dato as Record<string, unknown>;
    if (typeof casoId !== "string" || !idsPermitidos.includes(casoId) || typeof etapa !== "string" || !ETAPAS.includes(etapa as EtapaDemo) || typeof fechaISO !== "string" || !Number.isFinite(Date.parse(fechaISO))) return null;
    // Una preparación interrumpida vuelve a revisión, sin inventar un resultado nuevo.
    return { casoId, etapa: etapa === "preparacion" ? "revision" : etapa as EtapaDemo, fechaISO };
  } catch { return null; }
}

export function pasoVisible(etapa: EtapaDemo): number {
  return ({ seleccion: 0, revision: 1, preparacion: 1, resultado: 2, recomendaciones: 3, reporte: 4, orientacion: 5, final: 5 })[etapa];
}

export function enlaceDirectorioDemo(casoId: string): string {
  return `/directorio?desde=reporte&caso=${encodeURIComponent(casoId)}`;
}
