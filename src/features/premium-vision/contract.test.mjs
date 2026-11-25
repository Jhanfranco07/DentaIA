import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPremiumVisionResult,
  isPremiumVisionResult,
  PREMIUM_VISION_CATEGORY_LABELS,
  PREMIUM_VISION_SCHEMA_VERSION,
} from "./contract.ts";
import { evaluateWithPremiumVisionProvider } from "./provider.ts";

const categories = Object.entries(PREMIUM_VISION_CATEGORY_LABELS);

function detection(index, originalLabel = "caries") {
  return {
    category: {
      original_label: originalLabel,
      label_es: PREMIUM_VISION_CATEGORY_LABELS[originalLabel],
      coco_category_id: index + 10,
      inference_class_index: index,
    },
    confidence: 0.75,
    bounding_box: {
      format: "xyxy",
      coordinate_space: "reference_image_pixels",
      origin: "top_left",
      x_min: 10 + index,
      y_min: 20,
      x_max: 70 + index,
      y_max: 90,
    },
  };
}

function result(overrides = {}) {
  const evaluation = {
    status: "evaluated",
    reference_image: { width: 640, height: 480 },
    image_quality: { status: "adequate", issues: [] },
    detections: [detection(0)],
    limitations: ["Fixture sintético; no constituye un diagnóstico."],
    error_code: null,
    ...overrides,
  };
  return {
    schema_version: PREMIUM_VISION_SCHEMA_VERSION,
    provider: { id: "rf-detr-premium", availability: "available" },
    model: {
      identifier: "rf-detr-small-oral-diseases-clean-v1",
      version: "synthetic-test-v1",
      architecture: "RF-DETR Small",
      weights_format: "pytorch",
      input_width: 512,
      input_height: 512,
    },
    evaluation,
  };
}

test("acepta una respuesta v1 completa y validable", () => {
  const value = result();
  assert.equal(isPremiumVisionResult(value), true);
  assert.doesNotThrow(() => assertPremiumVisionResult(value));
});

test("valida la salida real del adaptador contra su descriptor antes de entregarla", async () => {
  const provider = {
    descriptor: { id: "rf-detr-premium", architecture: "RF-DETR Small", inputWidth: 512, inputHeight: 512, weightsFormat: "pytorch" },
    evaluate: async () => result(),
  };
  const input = { image: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg", referenceImage: { width: 640, height: 480 } };
  assert.equal((await evaluateWithPremiumVisionProvider(provider, input)).schema_version, PREMIUM_VISION_SCHEMA_VERSION);
  await assert.rejects(() => evaluateWithPremiumVisionProvider({ ...provider, evaluate: async () => ({ invalid: true }) }, input), /resultado incompatible/);
});

test("acepta exactamente las seis etiquetas originales y conserva IDs COCO separados de los índices de inferencia", () => {
  const detections = categories.map(([original], index) => detection(index, original));
  const value = result({ detections });
  assert.equal(isPremiumVisionResult(value), true);
  assert.deepEqual(detections.map(item => item.category.original_label), [
    "calculus", "caries", "gingivitis", "missing teeth", "tooth_discolation", "ulcer",
  ]);
  assert.notEqual(detections[0].category.coco_category_id, detections[0].category.inference_class_index);
});

test("rechaza categorías desconocidas y traducciones que no corresponden a la etiqueta original", () => {
  assert.equal(isPremiumVisionResult(result({ detections: [detection(0, "unknown") ] })), false);
  const wrongTranslation = detection(0);
  wrongTranslation.category.label_es = "Diagnóstico de caries";
  assert.equal(isPremiumVisionResult(result({ detections: [wrongTranslation] })), false);
});

test("rechaza confidence fuera de 0..1 o no finito", () => {
  for (const confidence of [-0.01, 1.01, Number.NaN]) {
    const invalid = detection(0);
    invalid.confidence = confidence;
    assert.equal(isPremiumVisionResult(result({ detections: [invalid] })), false);
  }
});

test("rechaza bounding boxes degenerados, ambiguos o fuera de la imagen de referencia", () => {
  const invalidBoxes = [
    { ...detection(0).bounding_box, x_min: 70 },
    { ...detection(0).bounding_box, x_max: 641 },
    { ...detection(0).bounding_box, coordinate_space: "normalized" },
    { ...detection(0).bounding_box, x_min: -1 },
  ];
  for (const bounding_box of invalidBoxes) {
    assert.equal(isPremiumVisionResult(result({ detections: [{ ...detection(0), bounding_box }] })), false);
  }
});

test("acepta bounding boxes apoyados exactamente en los límites de la imagen", () => {
  const edgeDetection = detection(0);
  edgeDetection.bounding_box = { ...edgeDetection.bounding_box, x_min: 0, y_min: 0, x_max: 640, y_max: 480 };
  assert.equal(isPremiumVisionResult(result({ detections: [edgeDetection] })), true);
});

test("admite hasta 100 detecciones y rechaza 101", () => {
  const oneHundred = Array.from({ length: 100 }, (_, index) => detection(index));
  assert.equal(isPremiumVisionResult(result({ detections: oneHundred })), true);
  assert.equal(isPremiumVisionResult(result({ detections: [...oneHundred, detection(100)] })), false);
});

test("rechaza respuestas incompletas o con versión de esquema desconocida", () => {
  const incomplete = result();
  delete incomplete.evaluation.image_quality;
  assert.equal(isPremiumVisionResult(incomplete), false);
  assert.equal(isPremiumVisionResult({ ...result(), schema_version: "dentaia.premium-vision-result.v2" }), false);
  assert.throws(() => assertPremiumVisionResult(incomplete), /resultado incompatible/);
});

test("diferencia evaluación sin detecciones de imagen no evaluable", () => {
  const withoutDetections = result({ status: "evaluated_no_detections", detections: [] });
  const notEvaluable = result({
    status: "not_evaluable",
    detections: [],
    image_quality: { status: "not_evaluated", issues: ["Imagen insuficiente"] },
  });
  assert.equal(isPremiumVisionResult(withoutDetections), true);
  assert.equal(isPremiumVisionResult(notEvaluable), true);
  assert.equal(isPremiumVisionResult(result({ status: "evaluated", detections: [] })), false);
  assert.equal(isPremiumVisionResult(result({ status: "not_evaluable", detections: [] })), false);
});

test("valida evaluación parcial con detecciones sin confundirla con una evaluación completa", () => {
  const partialWithDetections = result({
    status: "partially_evaluated",
    image_quality: { status: "review", issues: ["Parte de la imagen no fue evaluable"] },
  });
  assert.equal(isPremiumVisionResult(partialWithDetections), true);
  assert.equal(isPremiumVisionResult(result({ status: "partially_evaluated" })), false);
});

test("acepta evaluación parcial sin detecciones cuando conserva limitaciones explícitas", () => {
  const partialWithoutDetections = result({
    status: "partially_evaluated",
    detections: [],
    image_quality: { status: "review", issues: ["Solo una región de la imagen fue evaluable"] },
    limitations: ["No detectar en la región evaluable no descarta enfermedad en la imagen completa."],
  });
  assert.equal(isPremiumVisionResult(partialWithoutDetections), true);
});

test("representa proveedor no disponible sin detecciones ni calidad inventada", () => {
  const unavailable = result({
    status: "provider_unavailable",
    detections: [],
    image_quality: { status: "not_evaluated", issues: [] },
    error_code: "PROVIDER_UNAVAILABLE",
  });
  unavailable.provider.availability = "unavailable";
  unavailable.model.version = null;
  assert.equal(isPremiumVisionResult(unavailable), true);
  assert.equal(isPremiumVisionResult({ ...unavailable, provider: { ...unavailable.provider, availability: "available" } }), false);
});

test("separa error de procesamiento de indisponibilidad del proveedor", () => {
  const processingError = result({
    status: "processing_error",
    detections: [],
    image_quality: { status: "not_evaluated", issues: [] },
    error_code: "PROCESSING_ERROR",
  });
  assert.equal(isPremiumVisionResult(processingError), true);
  assert.equal(isPremiumVisionResult({ ...processingError, provider: { ...processingError.provider, availability: "unavailable" } }), false);
});
