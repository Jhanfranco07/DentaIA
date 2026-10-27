/** Enlaces internos: nunca se utiliza una URL externa proporcionada por la consulta. */
export function enlaceSolicitud(id: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? `/solicitudes?odontologo=${encodeURIComponent(id)}` : "/solicitudes";
}
