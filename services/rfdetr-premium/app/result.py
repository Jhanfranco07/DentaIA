"""Pure mapping of RF-DETR postprocessor rows into Premium Vision v1."""
from __future__ import annotations

import math

LABELS = (
    ("calculus", "Cálculo dental"),
    ("caries", "Posibles signos de caries"),
    ("gingivitis", "Posibles signos de gingivitis"),
    ("missing teeth", "Ausencia dental aparente"),
    ("tooth_discolation", "Decoloración dental"),
    ("ulcer", "Posible úlcera oral"),
)
MODEL = {"identifier": "rfdetr-small-premium", "version": "1.0.0", "architecture": "RF-DETR Small",
         "weights_format": "pytorch", "input_width": 512, "input_height": 512}
LIMITATION = "Hallazgos fotográficos preliminares; requieren evaluación profesional y no constituyen diagnóstico."


def map_rows(rows: list[tuple[int, float, tuple[float, float, float, float]]], width: int, height: int) -> dict:
    if not isinstance(width, int) or not isinstance(height, int) or width < 1 or height < 1:
        raise ValueError("image_dimensions")
    detections = []
    for index, score, box in rows:
        if index == 6:  # Internal background, distinct from COCO category 6.
            continue
        if not isinstance(index, int) or index < 0 or index >= len(LABELS):
            raise ValueError("class_index")
        if not math.isfinite(score) or score <= 0.35 or score > 1:
            raise ValueError("confidence")
        x1, y1, x2, y2 = box
        if not all(math.isfinite(v) for v in box) or not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
            raise ValueError("bounding_box")
        original, spanish = LABELS[index]
        detections.append({
            "category": {"original_label": original, "label_es": spanish,
                         "coco_category_id": index + 1, "inference_class_index": index},
            "confidence": score,
            "bounding_box": {"format": "xyxy", "coordinate_space": "reference_image_pixels",
                             "origin": "top_left", "x_min": x1, "y_min": y1, "x_max": x2, "y_max": y2},
        })
    truncated = len(detections) > 100
    detections = detections[:100]
    return {
        "schema_version": "dentaia.premium-vision-result.v1",
        "provider": {"id": "rf-detr-premium", "availability": "available"},
        "model": MODEL.copy(),
        "evaluation": {
            "status": "partially_evaluated" if truncated else "evaluated" if detections else "evaluated_no_detections",
            "reference_image": {"width": width, "height": height},
            "image_quality": {"status": "review", "issues": ["La calidad clínica de la fotografía no se evalúa automáticamente."]},
            "detections": detections,
            "limitations": [LIMITATION] + (["Se limitaron los resultados a 100 detecciones."] if truncated else []),
            "error_code": None,
        },
    }
