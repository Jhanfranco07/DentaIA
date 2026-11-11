/** Enlaces internos: nunca se utiliza una URL externa proporcionada por la consulta. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASOS_REPORTE = new Set(["cuidado-habitual", "atencion-preventiva", "cuidado-encias"]);

/** Conserva únicamente el origen demostrativo conocido, sin aceptar destinos arbitrarios. */
export function contextoReporte(busqueda: string): string {
  const parametros = new URLSearchParams(busqueda);
  const caso = parametros.get("caso") ?? "";
  return parametros.get("desde") === "reporte" && CASOS_REPORTE.has(caso)
    ? new URLSearchParams({ desde: "reporte", caso }).toString() : "";
}

export function enlaceSolicitud(id: string, contexto = ""): string {
  if (!UUID.test(id)) return "/solicitudes";
  const origen = contextoReporte(contexto);
  return `/solicitudes?odontologo=${encodeURIComponent(id)}${origen ? `&${origen}` : ""}`;
}

/** El regreso tras iniciar sesión solo admite una solicitud interna con profesional válido. */
export function retornoSolicitud(destino: string | null): string | null {
  if (!destino || !destino.startsWith("/solicitudes?")) return null;
  try {
    const url = new URL(destino, "https://dentaia.local");
    const id = url.searchParams.get("odontologo") ?? "";
    if (url.origin !== "https://dentaia.local" || url.pathname !== "/solicitudes" || !UUID.test(id)) return null;
    return enlaceSolicitud(id, url.search);
  } catch { return null; }
}
