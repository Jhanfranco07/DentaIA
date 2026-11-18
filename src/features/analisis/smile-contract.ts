export type OralBasicDetection = {
  class: "toothLoss" | "dentalCrowding";
  label: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
};

export type OralBasicAnalysis = {
  status: "evaluated" | "unavailable";
  model: "oral-disease-union-xfe9b/8";
  detections: OralBasicDetection[];
  limitations: string;
  overlay_url?: string;
};

export function isOralBasicAnalysis(value: unknown): value is OralBasicAnalysis {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<OralBasicAnalysis>;
  return (item.status === "evaluated" || item.status === "unavailable")
    && item.model === "oral-disease-union-xfe9b/8"
    && Array.isArray(item.detections)
    && item.detections.length <= 30
    && item.detections.every(d => d && ["toothLoss", "dentalCrowding"].includes(d.class)
      && typeof d.label === "string" && finite(d.confidence) && d.confidence >= 0.5 && d.confidence <= 1
      && d.box && [d.box.x1, d.box.x2, d.box.y1, d.box.y2].every(finite))
    && typeof item.limitations === "string"
    && (item.overlay_url === undefined || (typeof item.overlay_url === "string" && item.overlay_url.startsWith("data:image/png;base64,")));
}

export type SmileRegion = {
  region_id: number;
  label: "tooth";
  evaluable: boolean;
  reason: string | null;
  valid_pixels: number;
  valid_fraction: number;
  b_median: number | null;
  level: "No evaluable" | "Sin amarillo destacado" | "Leve" | "Moderado" | "Intenso";
  delta_l_halves: number | null;
  delta_b_halves: number | null;
  illumination_warning: boolean;
  partial: boolean;
  zone_fraction: number;
  zone_level: "Leve" | "Moderado" | "Intenso" | "Sin amarillo destacado" | null;
};

export type SmileResult = {
  status: "evaluable" | "partially_evaluable" | "not_evaluable";
  model: "teeth-4coz7/1";
  image_width: number;
  image_height: number;
  inference_ms: number;
  analysis_ms: number;
  thresholds: Record<string, number>;
  detected_regions: number;
  evaluable_regions: number;
  lighting_quality: "adequate" | "review" | "not_evaluable";
  regions: SmileRegion[];
  warnings: string[];
  limitations: string[];
};

export type SmileAnalysisResponse = {
  result: SmileResult;
  overlay_url?: string;
  oral_analysis?: OralBasicAnalysis;
};

export type SmileExplanation = {
  summary: string;
  observations: string[];
  recommendation: string;
  disclaimer: string;
  source: "openai" | "mock" | "template";
  oral_summary?: string;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableFinite(value: unknown): value is number | null {
  return value === null || finite(value);
}

export function isSmileRegion(value: unknown): value is SmileRegion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SmileRegion>;
  return Number.isInteger(item.region_id) && Number(item.region_id) > 0 && item.label === "tooth"
    && typeof item.evaluable === "boolean" && (item.reason === null || typeof item.reason === "string")
    && Number.isInteger(item.valid_pixels) && Number(item.valid_pixels) >= 0
    && finite(item.valid_fraction) && item.valid_fraction >= 0 && item.valid_fraction <= 1
    && nullableFinite(item.b_median) && ["No evaluable", "Sin amarillo destacado", "Leve", "Moderado", "Intenso"].includes(String(item.level))
    && nullableFinite(item.delta_l_halves) && nullableFinite(item.delta_b_halves)
    && typeof item.illumination_warning === "boolean" && typeof item.partial === "boolean"
    && finite(item.zone_fraction) && item.zone_fraction >= 0 && item.zone_fraction <= 1
    && (item.zone_level === null || (typeof item.zone_level === "string" && ["Leve", "Moderado", "Intenso", "Sin amarillo destacado"].includes(item.zone_level)));
}

export function isSmileResult(value: unknown): value is SmileResult {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SmileResult>;
  const statuses = ["evaluable", "partially_evaluable", "not_evaluable"];
  const lighting = ["adequate", "review", "not_evaluable"];
  return statuses.includes(String(item.status)) && item.model === "teeth-4coz7/1"
    && finite(item.image_width) && item.image_width > 0 && finite(item.image_height) && item.image_height > 0
    && finite(item.inference_ms) && item.inference_ms >= 0 && finite(item.analysis_ms) && item.analysis_ms >= 0
    && !!item.thresholds && Object.values(item.thresholds).every(finite)
    && Number.isInteger(item.detected_regions) && Number(item.detected_regions) >= 0
    && Number.isInteger(item.evaluable_regions) && Number(item.evaluable_regions) >= 0
    && lighting.includes(String(item.lighting_quality)) && Array.isArray(item.regions)
    && item.regions.every(isSmileRegion) && item.regions.length === item.detected_regions
    && Array.isArray(item.warnings) && item.warnings.every(text => typeof text === "string")
    && Array.isArray(item.limitations) && item.limitations.every(text => typeof text === "string");
}

export function isSmileAnalysisResponse(value: unknown): value is SmileAnalysisResponse {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SmileAnalysisResponse>;
  return isSmileResult(item.result) && (item.overlay_url === undefined || typeof item.overlay_url === "string")
    && (item.oral_analysis === undefined || isOralBasicAnalysis(item.oral_analysis));
}

export function isSmileExplanation(value: unknown): value is SmileExplanation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SmileExplanation>;
  return typeof item.summary === "string" && item.summary.length > 0
    && Array.isArray(item.observations) && item.observations.every(text => typeof text === "string")
    && typeof item.recommendation === "string" && typeof item.disclaimer === "string"
    && ["openai", "mock", "template"].includes(String(item.source));
}

export function countReviewRegions(result: SmileResult) {
  return result.regions.filter(region => !region.evaluable || region.partial || region.level !== "Sin amarillo destacado" || region.illumination_warning).length;
}

export function summarizeRegionStates(result: SmileResult) {
  return {
    detected: result.regions.length,
    evaluable: result.regions.filter(region => region.evaluable).length,
    notEvaluable: result.regions.filter(region => !region.evaluable).length,
    chromaticWarnings: result.regions.filter(region => region.evaluable && (region.partial || region.level !== "Sin amarillo destacado")).length,
    lightingWarnings: result.regions.filter(region => region.evaluable && region.illumination_warning).length,
    warningRegions: countReviewRegions(result),
  };
}
