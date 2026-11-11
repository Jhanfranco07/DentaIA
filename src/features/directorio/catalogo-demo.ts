import type { Dentista, DemoLocationPublica, DentistaDirectorio, UbicacionPublica } from "./tipos";

export const VERSION_CATALOGO_DEMO = "directorio-demo-2026-11-v1";
export const AVISO_PERFILES_DEMO = "Perfiles de demostración. No representan profesionales verificados ni consultorios disponibles para atención";

// Identidades inventadas para pruebas académicas. Los puntos son centroides aproximados, no domicilios.
const filas = [
  ["Alma Valcárcel", "Odontología general", "Miraflores", -12.119, -77.030],
  ["Bruno Lévano", "Ortodoncia", "San Isidro", -12.097, -77.036],
  ["Camila Ugarte", "Endodoncia", "Surco", -12.145, -76.991],
  ["Darío Montalva", "Periodoncia", "La Molina", -12.078, -76.911],
  ["Elena Quispeña", "Odontopediatría", "San Borja", -12.108, -77.001],
  ["Fabio Nacarino", "Rehabilitación oral", "Barranco", -12.149, -77.021],
  ["Gala Sorelli", "Cirugía oral", "Jesús María", -12.073, -77.049],
  ["Hugo Altamir", "Odontología general", "Pueblo Libre", -12.077, -77.063],
  ["Irene Beltrana", "Ortodoncia", "Magdalena del Mar", -12.091, -77.070],
  ["Julián Cárdenas", "Endodoncia", "Lince", -12.084, -77.035],
  ["Karla Menacho", "Periodoncia", "Surquillo", -12.111, -77.018],
  ["Leo Villaflor", "Odontopediatría", "San Miguel", -12.077, -77.085],
  ["Mara Solandía", "Rehabilitación oral", "Chorrillos", -12.174, -77.021],
  ["Nico Peralta", "Cirugía oral", "Breña", -12.060, -77.052],
  ["Olivia Salceda", "Odontología general", "Rímac", -12.031, -77.034],
  ["Pablo Arandia", "Ortodoncia", "Los Olivos", -11.991, -77.070],
  ["Renata Bellido", "Endodoncia", "Comas", -11.954, -77.058],
  ["Sergio Zambrana", "Periodoncia", "Ate", -12.027, -76.925],
  ["Tania Cordera", "Odontopediatría", "Villa El Salvador", -12.216, -76.943],
  ["Ulises Marengo", "Rehabilitación oral", "Lima", -12.046, -77.043],
] as const;

export const CATALOGO_DEMO = filas.map(([name, specialty, district, latitude, longitude], index) => {
  const numero = String(index + 1).padStart(2, "0");
  return {
    id: `d36a2026-0000-4000-8000-0000000000${numero}`,
    slug: `odontologo-demo-s6-${numero}`,
    name, specialty, district, latitude, longitude,
    practice_name: `Punto académico DEMO ${numero}`,
    description: `Perfil ficticio de ${specialty.toLowerCase()} creado para probar el directorio académico de DentaIA. No representa a una persona colegiada ni ofrece atención.`,
    source: VERSION_CATALOGO_DEMO,
  };
});

export function perfilDemo(id: string) { return CATALOGO_DEMO.find(perfil => perfil.id === id); }

export function unirCatalogoDemo(ubicaciones: readonly DemoLocationPublica[]): DentistaDirectorio[] {
  const porSlug = new Map(ubicaciones.filter(u => u.is_demo && u.is_published && !u.requests_enabled).map(u => [u.slug, u]));
  return CATALOGO_DEMO.flatMap(perfil => {
    const punto = porSlug.get(perfil.slug);
    if (!punto || punto.district !== perfil.district || punto.name !== perfil.practice_name) return [];
    const dentista: Dentista = {
      id: perfil.id, slug: perfil.slug, name: perfil.name, specialty: perfil.specialty,
      district: perfil.district, description: perfil.description, initials: perfil.name.split(" ").map(p => p[0]).join(""),
      avatar_color: "#e3f6f0", consultation_price: 0, currency: "PEN", created_at: "2026-11-11T00:00:00Z",
      is_active: true, is_demo: true,
    };
    const ubicacion: UbicacionPublica = {
      id: punto.id, dentist_id: perfil.id, practice_name: punto.name,
      practice_address: `Punto representativo en ${punto.district}; no es una dirección de atención`,
      latitude: punto.latitude, longitude: punto.longitude, created_at: "2026-11-11T00:00:00Z",
    };
    return [{ ...dentista, ubicaciones: [ubicacion] }];
  });
}
