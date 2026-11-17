import type { DentistaDirectorio, MarcadorDemo, UbicacionPublica } from "./tipos";

// Estas identidades están asociadas a cuentas de QA, no a profesionales habilitados.
// La vista de catálogo también puede mostrar estos perfiles como DEMO ficticios, sin activar registros ni citas.
// Los puntos son esquemáticos y no deben mostrarse como consultorios reales en Production.
const QA = [
  { id: "08d0c38f-2505-43ae-9c3a-2b3ccfa6b2fb", slug: "fase8-demo-a-e19e6bf1", name: "Odontologo Demo A", latitude: -12.0464, longitude: -77.0428 },
  { id: "77a82d0a-909a-4833-825d-cd4d57cf2a2b", slug: "fase8-demo-b-e19e6bf1", name: "Odontologo Demo B", latitude: -12.0514, longitude: -77.0428 },
] as const;

export function qaPreviewPermitido(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === "integration/pr71-pr74-compat-20261117"
    && env.DENTAIA_CLINICAL_PREVIEW_ENABLED === "true";
}

export function esPerfilQa(id: string): boolean {
  return QA.some(perfil => perfil.id === id);
}

function ubicacionQa(perfil: (typeof QA)[number]): UbicacionPublica {
  return {
    id: perfil.id,
    dentist_id: perfil.id,
    practice_name: "Zona de referencia en Lima",
    practice_address: "Punto visual de prueba; no es una dirección de atención",
    latitude: perfil.latitude,
    longitude: perfil.longitude,
    created_at: "2026-11-17T00:00:00.000Z",
  };
}

export function perfilQa(id: string): DentistaDirectorio | undefined {
  const perfil = QA.find(item => item.id === id);
  if (!perfil) return undefined;
  return {
    id: perfil.id,
    slug: perfil.slug,
    name: perfil.name,
    specialty: "Odontología general",
    district: "Lima (zona de referencia)",
    consultation_price: 0,
    currency: "PEN",
    initials: "QA",
    avatar_color: "#007f85",
    description: "Perfil académico con una cuenta odontológica que permite administrar servicios y verificar el flujo de publicación de DentaIA.",
    is_demo: true,
    is_active: false,
    created_at: "2026-11-04T00:58:04.000Z",
    ubicaciones: [ubicacionQa(perfil)],
  };
}

export function perfilesQa(): DentistaDirectorio[] {
  return QA.map(item => perfilQa(item.id)!);
}

export function marcadoresQa(): MarcadorDemo[] {
  return QA.map(perfil => ({
    id: perfil.id,
    slug: perfil.slug,
    name: perfil.name,
    district: "Lima",
    city: "Lima",
    country: "Perú",
    latitude: perfil.latitude,
    longitude: perfil.longitude,
    public_label: "Punto ilustrativo para probar el mapa; no es un consultorio.",
    tipo: "demo" as const,
    dentist_id: perfil.id,
  }));
}
