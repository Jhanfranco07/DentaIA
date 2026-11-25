export const PREMIUM_VISION_SCHEMA_VERSION = "dentaia.premium-vision-result.v1" as const;
export const PREMIUM_VISION_PROVIDER_ID = "rf-detr-premium" as const;

export const PREMIUM_VISION_CATEGORY_LABELS = {
  calculus: "Cálculo dental",
  caries: "Posibles signos de caries",
  gingivitis: "Posibles signos de gingivitis",
  "missing teeth": "Ausencia dental aparente",
  tooth_discolation: "Decoloración dental",
  ulcer: "Posible úlcera oral",
} as const;

export type PremiumVisionCategory = keyof typeof PREMIUM_VISION_CATEGORY_LABELS;
export type PremiumVisionEvaluationStatus =
  | "evaluated"
  | "evaluated_no_detections"
  | "partially_evaluated"
  | "not_evaluable"
  | "provider_unavailable"
  | "processing_error";

export type PremiumVisionBoundingBox = {
  format: "xyxy";
  coordinate_space: "reference_image_pixels";
  origin: "top_left";
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
};

export type PremiumVisionDetection = {
  category: {
    original_label: PremiumVisionCategory;
    label_es: typeof PREMIUM_VISION_CATEGORY_LABELS[PremiumVisionCategory];
    coco_category_id: number;
    inference_class_index: number;
  };
  confidence: number;
  bounding_box: PremiumVisionBoundingBox;
};

export type PremiumVisionResult = {
  schema_version: typeof PREMIUM_VISION_SCHEMA_VERSION;
  provider: {
    id: typeof PREMIUM_VISION_PROVIDER_ID;
    availability: "available" | "unavailable";
  };
  model: {
    identifier: string;
    version: string | null;
    architecture: "RF-DETR Small";
    weights_format: "pytorch";
    input_width: 512;
    input_height: 512;
  };
  evaluation: {
    status: PremiumVisionEvaluationStatus;
    reference_image: { width: number; height: number };
    image_quality: {
      status: "adequate" | "review" | "not_evaluated";
      issues: string[];
    };
    detections: PremiumVisionDetection[];
    limitations: string[];
    error_code: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function boundedTextList(value: unknown, maximumItems: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems
    && value.every(item => boundedText(item, 500));
}

function isCategory(value: unknown): value is PremiumVisionDetection["category"] {
  if (!isRecord(value) || !exactKeys(value, ["original_label", "label_es", "coco_category_id", "inference_class_index"])) return false;
  const original = value.original_label;
  return typeof original === "string"
    && Object.hasOwn(PREMIUM_VISION_CATEGORY_LABELS, original)
    && value.label_es === PREMIUM_VISION_CATEGORY_LABELS[original as PremiumVisionCategory]
    && nonNegativeInteger(value.coco_category_id)
    && nonNegativeInteger(value.inference_class_index);
}

function isBoundingBox(value: unknown, width: number, height: number): value is PremiumVisionBoundingBox {
  if (!isRecord(value) || !exactKeys(value, ["format", "coordinate_space", "origin", "x_min", "y_min", "x_max", "y_max"])) return false;
  return value.format === "xyxy"
    && value.coordinate_space === "reference_image_pixels"
    && value.origin === "top_left"
    && [value.x_min, value.y_min, value.x_max, value.y_max].every(finite)
    && Number(value.x_min) >= 0 && Number(value.y_min) >= 0
    && Number(value.x_min) < Number(value.x_max) && Number(value.y_min) < Number(value.y_max)
    && Number(value.x_max) <= width && Number(value.y_max) <= height;
}

function isDetection(value: unknown, width: number, height: number): value is PremiumVisionDetection {
  if (!isRecord(value) || !exactKeys(value, ["category", "confidence", "bounding_box"])) return false;
  return isCategory(value.category)
    && finite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
    && isBoundingBox(value.bounding_box, width, height);
}

function consistentEvaluation(result: PremiumVisionResult) {
  const { availability } = result.provider;
  const { status, detections, image_quality: quality, limitations, error_code: error } = result.evaluation;
  const hasError = boundedText(error, 120);
  const modelVersionAvailable = boundedText(result.model.version, 120);

  if (status === "evaluated") return availability === "available" && modelVersionAvailable
    && detections.length > 0 && quality.status !== "not_evaluated" && error === null;
  if (status === "evaluated_no_detections") return availability === "available" && modelVersionAvailable
    && detections.length === 0 && quality.status !== "not_evaluated" && error === null;
  if (status === "partially_evaluated") return availability === "available" && modelVersionAvailable
    && quality.status === "review" && limitations.length > 0 && error === null;
  if (status === "not_evaluable") return availability === "available" && modelVersionAvailable
    && detections.length === 0 && quality.status === "not_evaluated" && limitations.length > 0 && error === null;
  if (status === "provider_unavailable") return availability === "unavailable"
    && detections.length === 0 && quality.status === "not_evaluated" && limitations.length > 0 && hasError;
  return status === "processing_error" && availability === "available" && modelVersionAvailable
    && detections.length === 0 && quality.status === "not_evaluated" && limitations.length > 0 && hasError;
}

export function isPremiumVisionResult(value: unknown): value is PremiumVisionResult {
  if (!isRecord(value) || !exactKeys(value, ["schema_version", "provider", "model", "evaluation"])) return false;
  if (value.schema_version !== PREMIUM_VISION_SCHEMA_VERSION) return false;

  const provider = value.provider;
  if (!isRecord(provider) || !exactKeys(provider, ["id", "availability"])
    || provider.id !== PREMIUM_VISION_PROVIDER_ID || !["available", "unavailable"].includes(String(provider.availability))) return false;

  const model = value.model;
  if (!isRecord(model) || !exactKeys(model, ["identifier", "version", "architecture", "weights_format", "input_width", "input_height"])
    || !boundedText(model.identifier, 120) || (model.version !== null && !boundedText(model.version, 120))
    || model.architecture !== "RF-DETR Small" || model.weights_format !== "pytorch"
    || model.input_width !== 512 || model.input_height !== 512) return false;

  const evaluation = value.evaluation;
  if (!isRecord(evaluation) || !exactKeys(evaluation, ["status", "reference_image", "image_quality", "detections", "limitations", "error_code"])) return false;
  const statuses: PremiumVisionEvaluationStatus[] = ["evaluated", "evaluated_no_detections", "partially_evaluated", "not_evaluable", "provider_unavailable", "processing_error"];
  if (!statuses.includes(evaluation.status as PremiumVisionEvaluationStatus)) return false;

  const image = evaluation.reference_image;
  if (!isRecord(image) || !exactKeys(image, ["width", "height"])
    || !positiveInteger(image.width) || !positiveInteger(image.height)) return false;

  const quality = evaluation.image_quality;
  if (!isRecord(quality) || !exactKeys(quality, ["status", "issues"])
    || !["adequate", "review", "not_evaluated"].includes(String(quality.status))
    || !boundedTextList(quality.issues, 20)) return false;

  if (!Array.isArray(evaluation.detections) || evaluation.detections.length > 100
    || !evaluation.detections.every(detection => isDetection(detection, image.width as number, image.height as number))
    || !boundedTextList(evaluation.limitations, 20)
    || (evaluation.error_code !== null && !boundedText(evaluation.error_code, 120))) return false;

  return consistentEvaluation(value as PremiumVisionResult);
}

export function assertPremiumVisionResult(value: unknown): asserts value is PremiumVisionResult {
  if (!isPremiumVisionResult(value)) throw new Error("El proveedor Premium devolvió un resultado incompatible con dentaia.premium-vision-result.v1.");
}
