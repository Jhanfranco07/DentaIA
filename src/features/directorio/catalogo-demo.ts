import type { Dentista, DemoLocationPublica, DentistaDirectorio, UbicacionPublica } from "./tipos";

export const VERSION_CATALOGO_DEMO = "directorio-demo-2026-11-v2";
export const AVISO_PERFILES_DEMO = "Perfiles de demostración. No representan profesionales verificados. Los centros son referencias geográficas independientes: no existe vinculación laboral ni atención gestionada por DentaIA.";

// Direcciones y coordenadas publicadas en fichas que citan el registro RENIPRESS/MINSA.
// Son referencias documentales, NO verificación presencial ni confirmación de atención actual.
// Los nombres de personas son ficticios y no tienen relación profesional con los centros.
const filas = [
  {
    "name": "Alma Valcárcel",
    "specialty": "Odontología general",
    "district": "San Borja",
    "latitude": -12.100849,
    "longitude": -76.999601,
    "practice_name": "Cerdent San Borja",
    "practice_address": "Av. San Borja Sur 781, piso 2, San Borja, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/consultorio-medico-cerdent-san-borja/"
  },
  {
    "name": "Bruno Lévano",
    "specialty": "Ortodoncia",
    "serviciosIlustrativos": ["Evaluación de alineación dental", "Control de ortodoncia"],
    "district": "Jesús María",
    "latitude": -12.089279,
    "longitude": -77.058167,
    "practice_name": "Cerdent Jesús María",
    "practice_address": "Av. Faustino Sánchez Carrión 615, of. 303, Jesús María, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/consultorio-medico-cerdent-jesus-maria/"
  },
  {
    "name": "Camila Ugarte",
    "specialty": "Endodoncia",
    "district": "La Molina",
    "latitude": -12.070348,
    "longitude": -76.95249,
    "practice_name": "Cerdent La Molina",
    "practice_address": "Av. Javier Prado Este 6210, of. 301, La Molina, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-este/centro-odontologico-cerdent-sac-la-molina/"
  },
  {
    "name": "Darío Montalva",
    "specialty": "Periodoncia",
    "district": "Miraflores",
    "latitude": -12.128138,
    "longitude": -77.005019,
    "practice_name": "Romandent Miraflores",
    "practice_address": "Av. Alfredo Benavides 2921, Miraflores, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-romandent-eirl-miraflores/"
  },
  {
    "name": "Elena Quispeña",
    "specialty": "Odontopediatría",
    "district": "San Isidro",
    "latitude": -12.106403,
    "longitude": -77.054749,
    "practice_name": "Romandent San Isidro",
    "practice_address": "Av. Augusto Pérez Araníbar 1764, San Isidro, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-romandent-san-isidro/"
  },
  {
    "name": "Fabio Nacarino",
    "specialty": "Rehabilitación oral",
    "district": "Santiago de Surco",
    "latitude": -12.105931,
    "longitude": -76.973386,
    "practice_name": "Romandent Surco",
    "practice_address": "Jr. El Polo 348, Santiago de Surco, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-sur/centro-odontologico-romandent-santiago-de-surco/"
  },
  {
    "name": "Gala Sorelli",
    "specialty": "Cirugía oral",
    "district": "Miraflores",
    "latitude": -12.119411,
    "longitude": -77.026132,
    "practice_name": "Dental Científica (Universidad Científica del Sur)",
    "practice_address": "Av. Paseo de la República 5514, Miraflores, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-de-la-universidad-cientifica-del-sur-dental-cientifica-miraflores/"
  },
  {
    "name": "Hugo Altamir",
    "specialty": "Odontología general",
    "district": "Miraflores",
    "latitude": -12.117637,
    "longitude": -77.031481,
    "practice_name": "Clínica Dental Smile Perfection",
    "practice_address": "Calle Coronel Inclán 235, piso 3, of. 307, Miraflores, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/consultorio-medico-clinica-dental-smile-perfection-miraflores/"
  },
  {
    "name": "Irene Beltrana",
    "specialty": "Ortodoncia",
    "district": "Lima",
    "latitude": -12.069504,
    "longitude": -77.037002,
    "practice_name": "Centro Odontológico Universidad Wiener",
    "practice_address": "Av. Arequipa 440-444, Lima, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-de-la-universidad-wiener-lima/"
  },
  {
    "name": "Julián Cárdenas",
    "specialty": "Endodoncia",
    "district": "Jesús María",
    "latitude": -12.07,
    "longitude": -77.0453,
    "practice_name": "Vital Dent Integral",
    "practice_address": "Av. Salaverry 1071, primer piso, Jesús María, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-integral-vital-dent-sac-jesus-maria/"
  },
  {
    "name": "Karla Menacho",
    "specialty": "Periodoncia",
    "district": "San Borja",
    "latitude": -12.110287,
    "longitude": -76.986509,
    "practice_name": "Centro Odontológico Americano Primavera",
    "practice_address": "Av. Primavera 643, interior 503, San Borja, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-americano-primavera-san-borja/"
  },
  {
    "name": "Leo Villaflor",
    "specialty": "Odontopediatría",
    "district": "Miraflores",
    "latitude": -12.12096,
    "longitude": -77.027807,
    "practice_name": "Dental Procare",
    "practice_address": "Calle Alcanfores 142, interior 303, Miraflores, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-dental-procare-miraflores/"
  },
  {
    "name": "Mara Solandía",
    "specialty": "Rehabilitación oral",
    "district": "Lima",
    "latitude": -12.074412,
    "longitude": -77.034597,
    "practice_name": "Bogdent",
    "practice_address": "Jr. Subteniente Alejandro Tirado 318, int. 201, Lima, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-bogdent-lima/"
  },
  {
    "name": "Nico Peralta",
    "specialty": "Cirugía oral",
    "district": "Chorrillos",
    "latitude": -12.177811,
    "longitude": -76.997082,
    "practice_name": "Odontosalud Chorrillos",
    "practice_address": "Av. El Sol 1242, La Campiña, Chorrillos, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-sur/centro-odontologico-odontosalud-chorrillos/"
  },
  {
    "name": "Olivia Salceda",
    "specialty": "Odontología general",
    "district": "Los Olivos",
    "latitude": -11.995633,
    "longitude": -77.080356,
    "practice_name": "Centro Odontológico Americano Los Olivos",
    "practice_address": "Av. Carlos Alberto Izaguirre 1268, Los Olivos, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-norte/centro-odontologico-americano-los-olivos-los-olivos/"
  },
  {
    "name": "Pablo Arandia",
    "specialty": "Ortodoncia",
    "district": "Chorrillos",
    "latitude": -12.17101,
    "longitude": -77.022508,
    "practice_name": "Multident Chorrillos",
    "practice_address": "Av. Defensores del Morro 714, interiores 208-209, Chorrillos, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-sur/centro-odontologico-multident-chorrillos/"
  },
  {
    "name": "Renata Bellido",
    "specialty": "Endodoncia",
    "district": "Pueblo Libre",
    "latitude": -12.074555,
    "longitude": -77.054864,
    "practice_name": "Centro Especializado en Odontoestomatología",
    "practice_address": "Av. Simón Bolívar 165, Pueblo Libre, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-centro-especializado-en-odontoestomatologia-pueblo-libre/"
  },
  {
    "name": "Sergio Zambrana",
    "specialty": "Periodoncia",
    "district": "San Miguel",
    "latitude": -12.071798,
    "longitude": -77.098367,
    "practice_name": "Dental Max San Miguel",
    "practice_address": "Calle Contisuyo 299, piso 2, int. 202, San Miguel, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-dental-max-san-miguel/"
  },
  {
    "name": "Tania Cordera",
    "specialty": "Odontopediatría",
    "district": "San Miguel",
    "latitude": -12.079831,
    "longitude": -77.079575,
    "practice_name": "Centro Odontológico Americano El Campillo",
    "practice_address": "Calle Ayarsa de Morales 237, San Miguel, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-americano-san-miguel-el-campillo-san-miguel/"
  },
  {
    "name": "Ulises Marengo",
    "specialty": "Rehabilitación oral",
    "district": "Lince",
    "latitude": -12.086597,
    "longitude": -77.039917,
    "practice_name": "Mueca Lince",
    "practice_address": "Av. Julio César Tello 615, Lince, Lima, Perú",
    "source_url": "https://www.establecimientosdesalud.info/lima-centro/centro-odontologico-mueca-lince/"
  }
] as const;

export const CATALOGO_DEMO = filas.map((fila, index) => {
  const numero = String(index + 1).padStart(2, "0");
  return {
    id: `d36a2026-0000-4000-8000-0000000000${numero}`,
    slug: `odontologo-demo-s6-${numero}`,
    ...fila,
    serviciosIlustrativos: "serviciosIlustrativos" in fila ? fila.serviciosIlustrativos : [],
    description: `Perfil ficticio de ${fila.specialty.toLowerCase()}, creado para una demostración académica. ${fila.practice_name} es únicamente una referencia geográfica basada en una ficha pública; no existe vinculación laboral ni atención disponible mediante este perfil.`,
    source: VERSION_CATALOGO_DEMO,
  };
});

export function perfilDemo(id: string) { return CATALOGO_DEMO.find(perfil => perfil.id === id); }

export function unirCatalogoDemo(ubicaciones: readonly DemoLocationPublica[]): DentistaDirectorio[] {
  const porSlug = new Map(ubicaciones.filter(u => u.is_demo && u.is_published && !u.requests_enabled).map(u => [u.slug, u]));
  return CATALOGO_DEMO.flatMap(perfil => {
    const punto = porSlug.get(perfil.slug);
    if (!punto || punto.district !== perfil.district || punto.name !== perfil.practice_name
        || Math.abs(punto.latitude - perfil.latitude) > 0.000001
        || Math.abs(punto.longitude - perfil.longitude) > 0.000001) return [];
    const dentista: Dentista = {
      id: perfil.id, slug: perfil.slug, name: perfil.name, specialty: perfil.specialty,
      district: perfil.district, description: perfil.description, initials: perfil.name.split(" ").map(p => p[0]).join(""),
      avatar_color: "#e3f6f0", consultation_price: 0, currency: "PEN", created_at: "2026-11-11T00:00:00Z",
      is_active: true, is_demo: true,
    };
    const ubicacion: UbicacionPublica = {
      id: punto.id, dentist_id: perfil.id, practice_name: punto.name,
      practice_address: perfil.practice_address,
      latitude: punto.latitude, longitude: punto.longitude, created_at: "2026-11-11T00:00:00Z",
    };
    return [{ ...dentista, ubicaciones: [ubicacion] }];
  });
}
