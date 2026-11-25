
import {
  isPremiumVisionResult, PREMIUM_VISION_CATEGORY_LABELS,
  type PremiumVisionCategory, type PremiumVisionResult,
} from "./contract.ts";

export const HISTORY_CONSENT_VERSION = "di214.v1";
export const HISTORY_PURPOSES = ["premium_history_results", "premium_history_photo_link"] as const;
export type HistoryPurpose = typeof HISTORY_PURPOSES[number];
export type CaptureProtocol = "frontal_intraoral_v1";
export type HistoryEvaluation = {
  id: string;
  date: string;
  captureProtocol: CaptureProtocol | null;
  result: PremiumVisionResult;
  photo: boolean;
  shareable: boolean;
  shares: string[];
};
export type HistoryPage = {
  items: HistoryEvaluation[];
  premium: boolean;
  consents: Partial<Record<HistoryPurpose, string>>;
  next: { id: string; before: string } | null;
  inferenceEnabled: boolean;
};

export const statusLabels: Record<PremiumVisionResult["evaluation"]["status"], string> = {
  evaluated: "Evaluación completa",
  evaluated_no_detections: "Evaluación completa sin detecciones",
  partially_evaluated: "Evaluación parcial",
  not_evaluable: "Imagen no evaluable",
  provider_unavailable: "Proveedor no disponible",
  processing_error: "Error de procesamiento",
};

const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function historyDto(value: unknown): Omit<HistoryPage, "inferenceEnabled"> {
  const invalid = () => { throw new Error("INVALID_PREMIUM_HISTORY"); };
  if (!record(value) || !Array.isArray(value.items) || value.items.length > 21
    || typeof value.premium !== "boolean" || !record(value.consents)) return invalid();
  const items = value.items.map((item): HistoryEvaluation => {
    if (!record(item) || !uuid(item.id) || typeof item.date !== "string" || !Number.isFinite(Date.parse(item.date))
      || (item.captureProtocol !== null && item.captureProtocol !== "frontal_intraoral_v1")
      || !isPremiumVisionResult(item.result) || typeof item.photo !== "boolean"
      || typeof item.shareable !== "boolean" || !Array.isArray(item.shares) || !item.shares.every(uuid)) return invalid();
    return {
      id: item.id, date: item.date, captureProtocol: item.captureProtocol,
      result: item.result, photo: item.photo, shareable: item.shareable, shares: item.shares,
    };
  });
  const consents: HistoryPage["consents"] = {};
  for (const purpose of HISTORY_PURPOSES) {
    const id = value.consents[purpose];
    if (id === undefined) continue;
    if (!uuid(id)) return invalid();
    consents[purpose] = id;
  }
  const last = items.length === 21 ? items[19] : null;
  return { items: items.slice(0,20), premium: value.premium, consents, next: last && { id: last.id, before: last.date } };
}

export function compareHistory(first: HistoryEvaluation, second: HistoryEvaluation) {
  const a = first.result;
  const b = second.result;
  if (first.id === second.id) return { reason: "Elige dos evaluaciones distintas." } as const;
  if (a.provider.id !== b.provider.id || a.schema_version !== b.schema_version || !a.model.version
    || a.model.identifier !== b.model.identifier || a.model.version !== b.model.version) {
    return { reason: "Las evaluaciones corresponden a proveedores, modelos o contratos diferentes." } as const;
  }
  const measurements = [a.evaluation, b.evaluation];
  if (measurements.some(e => !["evaluated","evaluated_no_detections"].includes(e.status))) {
    return { reason: "La comparación requiere dos evaluaciones completas." } as const;
  }
  if (first.captureProtocol !== "frontal_intraoral_v1" || first.captureProtocol !== second.captureProtocol
    || measurements.some(e => e.image_quality.status !== "adequate" || e.image_quality.issues.length > 0 || e.limitations.length > 0)
    || a.evaluation.reference_image.width !== b.evaluation.reference_image.width
    || a.evaluation.reference_image.height !== b.evaluation.reference_image.height) {
    return { reason: "Las condiciones de captura y calidad documentadas no permiten una comparación fiable." } as const;
  }
  const taxonomy = new Map<PremiumVisionCategory,string>();
  const coco = new Map<number,PremiumVisionCategory>();
  const indices = new Map<number,PremiumVisionCategory>();
  for (const { detections } of measurements) {
    for (const { category } of detections) {
      const { original_label: label, coco_category_id: id, inference_class_index: index } = category;
      const identity = id + "/" + index;
      if ((taxonomy.has(label) && taxonomy.get(label) !== identity)
        || (coco.has(id) && coco.get(id) !== label) || (indices.has(index) && indices.get(index) !== label)) {
        return { reason: "La taxonomía documentada difiere entre detecciones." } as const;
      }
      taxonomy.set(label, identity);
      coco.set(id,label);
      indices.set(index,label);
    }
  }
  return {
    rows: (Object.keys(PREMIUM_VISION_CATEGORY_LABELS) as PremiumVisionCategory[]).map(category => ({
      label: PREMIUM_VISION_CATEGORY_LABELS[category],
      counts: measurements.map(e => e.detections.filter(d => d.category.original_label === category).length),
    })),
  } as const;
}
