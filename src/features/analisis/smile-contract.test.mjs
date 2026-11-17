import test from "node:test";
import assert from "node:assert/strict";
import { countReviewRegions, isSmileAnalysisResponse, isSmileExplanation, summarizeRegionStates } from "./smile-contract.ts";

const region = { region_id: 1, label: "tooth", evaluable: true, reason: null, valid_pixels: 100,
  valid_fraction: .8, b_median: 11, level: "Sin amarillo destacado", delta_l_halves: 2,
  delta_b_halves: 1, illumination_warning: false, partial: false, zone_fraction: 0, zone_level: null };
const result = { status: "evaluable", model: "teeth-4coz7/1", image_width: 800, image_height: 500,
  inference_ms: 20, analysis_ms: 4, thresholds: { partial_delta_halves: 5, light_difference_warning: 12 }, detected_regions: 1,
  evaluable_regions: 1, lighting_quality: "adequate", regions: [region], warnings: [], limitations: ["Experimental"] };

test("acepta el contrato estructurado de Smile sin inventar campos clínicos", () => {
  assert.equal(isSmileAnalysisResponse({ result }), true);
  assert.equal(countReviewRegions(result), 0);
});

test("acepta la respuesta serializada de Smile V17 sin incluir el overlay Base64", () => {
  const jsonRealSinImagen = JSON.parse(JSON.stringify({ result }));
  assert.equal("overlay_url" in jsonRealSinImagen, false);
  assert.equal(isSmileAnalysisResponse(jsonRealSinImagen), true);
  assert.deepEqual(jsonRealSinImagen.result.warnings, []);
  assert.equal(jsonRealSinImagen.result.lighting_quality, "adequate");
});

test("rechaza modelos, regiones y números inválidos", () => {
  assert.equal(isSmileAnalysisResponse({ result: { ...result, model: "otro" } }), false);
  assert.equal(isSmileAnalysisResponse({ result: { ...result, regions: [], detected_regions: 1 } }), false);
  assert.equal(isSmileAnalysisResponse({ result: { ...result, inference_ms: Number.NaN } }), false);
  assert.equal(isSmileAnalysisResponse({ result: { ...result, lighting_quality: undefined } }), false);
  assert.equal(isSmileAnalysisResponse({ result: { ...result, warnings: undefined } }), false);
});

test("valida explicaciones estructuradas y su fallback", () => {
  assert.equal(isSmileExplanation({ summary: "Resumen", observations: [], recommendation: "Consulta", disclaimer: "No diagnóstico", source: "template" }), true);
  assert.equal(isSmileExplanation({ summary: "", observations: [], recommendation: "", disclaimer: "", source: "ai" }), false);
});

test("separa detectadas, evaluables y cada tipo de advertencia sin duplicar el total", () => {
  const regions = [
    region,
    { ...region, region_id: 2, partial: true },
    { ...region, region_id: 3, illumination_warning: true },
    { ...region, region_id: 4, partial: true, illumination_warning: true },
    { ...region, region_id: 5, evaluable: false, b_median: null, level: "No evaluable" },
  ];
  const summary = summarizeRegionStates({ ...result, detected_regions: 5, evaluable_regions: 4, regions });
  assert.deepEqual(summary, { detected: 5, evaluable: 4, notEvaluable: 1,
    chromaticWarnings: 2, lightingWarnings: 2, warningRegions: 4 });
});
