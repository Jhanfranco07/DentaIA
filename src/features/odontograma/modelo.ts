export const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
export const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;
export type Fdi = (typeof ARCADA_SUPERIOR | typeof ARCADA_INFERIOR)[number];

export const SUPERFICIES = {
  mesial: "Mesial", distal: "Distal", vestibular: "Vestibular",
  palatina: "Palatina", lingual: "Lingual", oclusal: "Oclusal", incisal: "Incisal",
} as const;
export type Superficie = keyof typeof SUPERFICIES;

export const CATALOGO = {
  caries: { etiqueta: "Caries", simbolo: "C", fase: "hallazgo", superficie: true },
  fractura: { etiqueta: "Fractura", simbolo: "F", fase: "hallazgo", superficie: true },
  ausencia: { etiqueta: "Pieza ausente", simbolo: "×", fase: "hallazgo", superficie: false },
  restauracion: { etiqueta: "Restauración", simbolo: "R", fase: "tratamiento", superficie: true },
  endodoncia: { etiqueta: "Endodoncia", simbolo: "E", fase: "tratamiento", superficie: false },
  protesis: { etiqueta: "Prótesis", simbolo: "P", fase: "tratamiento", superficie: false },
  implante: { etiqueta: "Implante", simbolo: "I", fase: "tratamiento", superficie: false },
  extraccion: { etiqueta: "Extracción", simbolo: "Ex", fase: "tratamiento", superficie: false },
  nota: { etiqueta: "Nota clínica", simbolo: "N", fase: "hallazgo", superficie: true },
} as const;
export type Estado = keyof typeof CATALOGO;
export const FASES = { hallazgo: "Hallazgo", planificado: "Planificado", realizado: "Realizado" } as const;
export type Fase = keyof typeof FASES;

export type Registro = {
  id: string;
  encounterId: string;
  tooth: Fdi;
  surface: Superficie | null;
  condition: Estado;
  phase: Fase;
  note: string;
  replacesId: string | null;
  correctionReason: string | null;
  recordedAt: string;
  author: string | null;
  active: boolean;
};

export type Observacion = {
  analysisId: string;
  key: string;
  source: "smile-v17" | "premium-vision";
  label: string;
  date: string;
  model: string;
  limitations: string[];
  confidence?: number;
};

export function esFdi(value: unknown): value is Fdi {
  return typeof value === "number" && Number.isInteger(value) && /^[1-4][1-8]$/.test(String(value));
}

export function superficiesDe(tooth: Fdi): Superficie[] {
  return ["mesial", "distal", "vestibular", tooth < 30 ? "palatina" : "lingual", tooth % 10 <= 3 ? "incisal" : "oclusal"];
}

export function esEstado(value: unknown): value is Estado {
  return typeof value === "string" && Object.hasOwn(CATALOGO, value);
}

export function ubicacionValida(tooth: unknown, surface: unknown, condition: Estado): boolean {
  return esFdi(tooth) && (surface === null || (CATALOGO[condition].superficie && superficiesDe(tooth).some(s => s === surface)));
}

export function faseValida(condition: Estado, phase: unknown): phase is Fase {
  return CATALOGO[condition].fase === "hallazgo" ? phase === "hallazgo" : phase === "planificado" || phase === "realizado";
}

export type Revision = {
  analysisId: string;
  key: string;
  decision: "accepted" | "corrected" | "dismissed";
  entryId: string | null;
  recordedAt: string;
};
export type ExpedienteOdontograma = {
  patientId: string;
  patientName: string | null;
  encounters: { id: string; date: string; editable: boolean }[];
  records: Registro[];
  observations: Observacion[];
  reviews: Revision[];
  availablePhotos: string[];
};

export type GuardarOdontograma = {
  id: string;
  membershipId: string;
  encounterId: string;
  record: {
    tooth: Fdi; surface: Superficie | null; condition: Estado; phase: Fase;
    note: string; replacesId: string | null; correctionReason: string | null;
  } | null;
  review: { analysisId: string; key: string; decision: Revision["decision"] } | null;
};
