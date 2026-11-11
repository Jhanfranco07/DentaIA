import type { DemoLocationPublica, MarcadorDemo } from "./tipos";
import { coordenadasValidas } from "./geolocalizacion.ts";

export const ETIQUETA_CLINICA_DEMO = "DEMO — Clínica ficticia, no ofrece atención real";

export function crearMarcadorDemo(ubicacion: DemoLocationPublica): MarcadorDemo | null {
  if (!ubicacion.is_demo || !ubicacion.is_published || ubicacion.requests_enabled
    || ubicacion.public_label !== ETIQUETA_CLINICA_DEMO
    || !coordenadasValidas(ubicacion.latitude, ubicacion.longitude)) return null;

  return {
    tipo: "demo",
    id: ubicacion.id,
    slug: ubicacion.slug,
    name: ubicacion.name,
    district: ubicacion.district,
    city: ubicacion.city,
    country: ubicacion.country,
    latitude: ubicacion.latitude,
    longitude: ubicacion.longitude,
    public_label: ubicacion.public_label,
  };
}
