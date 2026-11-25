import { isSmileAnalysisResponse, isSmileResult } from "../analisis/smile-contract.ts";
import { assertPremiumVisionResult } from "../premium-vision/contract.ts";
import type { Observacion } from "./modelo.ts";

type Analysis = { id: string; date: string; version: string; result: unknown };

export function observacionesSmile({ id, date, version, result }: Analysis): Observacion[] {
  const response = isSmileAnalysisResponse(result) ? result : isSmileResult(result) ? { result } : null;
  if (!response) return [];
  const smile = response.result;
  const limitations = [...smile.limitations, ...smile.warnings].slice(0, 12);
  const regions = smile.regions.filter(r => r.evaluable && r.level !== "Sin amarillo destacado" && r.level !== "No evaluable");
  const duplicates = new Set<number>();
  const seen = new Set<number>();
  for (const r of smile.regions) {
    if (seen.has(r.region_id)) duplicates.add(r.region_id);
    seen.add(r.region_id);
  }
  return regions.filter(r => !duplicates.has(r.region_id)).map(r => ({
    analysisId: id, key: `region:${r.region_id}`, source: "smile-v17",
    label: `Amarillo visible · ${r.level.toLowerCase()} · región ${r.region_id}`,
    date, model: `Smile V17 ${version} · ${smile.model}`, limitations: [
      ...limitations, ...(r.partial ? ["Región evaluada parcialmente."] : []),
      ...(r.illumination_warning ? ["La iluminación de la región requiere revisión."] : []),
    ],
  }));
}

export function observacionesPremium({ id, date, result }: Analysis): Observacion[] {
  try {
    assertPremiumVisionResult(result);
    return result.evaluation.detections.map((item, index) => ({
      analysisId: id, key: `detection:${index}`, source: "premium-vision",
      label: item.category.label_es, date, model: result.model.version ?? result.provider.id,
      limitations: result.evaluation.limitations, confidence: item.confidence,
    }));
  } catch {
    return [];
  }
}
