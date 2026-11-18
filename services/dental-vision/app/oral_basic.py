"""Experimental basic oral structure detections from Roboflow (no clinical claims)."""
from __future__ import annotations

import base64
import io
import json
import logging
import os
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw

MODEL = "oral-disease-union-xfe9b/8"
ENDPOINT = f"https://serverless.roboflow.com/{MODEL}"
ALLOWED = {
    "toothLoss": "Posible ausencia dental",
    "dentalCrowding": "Posible apiñamiento dental",
}
MIN_CONFIDENCE = 0.50
LOGGER = logging.getLogger("dentaia_smile.oral")


def parse_predictions(response: dict, width: int, height: int) -> list[dict]:
    """Only expose allowlisted findings and normalized image coordinates."""
    meta = response.get("image") or {}
    try:
        source_width = float(meta.get("width") or width)
        source_height = float(meta.get("height") or height)
    except (TypeError, ValueError):
        return []
    if source_width <= 0 or source_height <= 0:
        return []
    sx, sy = width / source_width, height / source_height
    output: list[dict] = []
    for prediction in response.get("predictions", []):
        if not isinstance(prediction, dict):
            continue
        label = prediction.get("class")
        if label not in ALLOWED:
            continue
        try:
            confidence = float(prediction["confidence"])
            x, y = float(prediction["x"]) * sx, float(prediction["y"]) * sy
            w, h = float(prediction["width"]) * sx, float(prediction["height"]) * sy
        except (KeyError, ValueError, TypeError):
            continue
        if not all(map(__import__("math").isfinite, (confidence, x, y, w, h))):
            continue
        if confidence < MIN_CONFIDENCE or confidence > 1 or w <= 0 or h <= 0:
            continue
        x1 = max(0, round(x - w / 2))
        y1 = max(0, round(y - h / 2))
        x2 = min(width, round(x + w / 2))
        y2 = min(height, round(y + h / 2))
        if x2 <= x1 or y2 <= y1:
            continue
        output.append({
            "class": label, "label": ALLOWED[label],
            "confidence": round(confidence, 4),
            "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        })
    return output[:30]


def infer(image: Image.Image) -> dict:
    key = os.environ.get("ROBOFLOW_API_KEY", "")
    if not key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured")
    binary = io.BytesIO()
    image.convert("RGB").save(binary, format="JPEG", quality=92)
    params = urllib.parse.urlencode({"api_key": key, "confidence": 50, "overlap": 50})
    request = urllib.request.Request(
        ENDPOINT + "?" + params,
        data=base64.b64encode(binary.getvalue()),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=25) as response:  # nosec B310: fixed HTTPS endpoint
        return json.loads(response.read().decode("utf-8"))


def analyze(image: Image.Image, response: dict | None = None) -> dict:
    if response is None:
        response = infer(image)
    detections = parse_predictions(response, image.width, image.height)
    overlay = image.convert("RGB").copy()
    draw = ImageDraw.Draw(overlay)
    for item in detections:
        box = item["box"]
        color = "#E5484D" if item["class"] == "toothLoss" else "#F59E0B"
        draw.rectangle((box["x1"], box["y1"], box["x2"], box["y2"]), outline=color, width=4)
    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG")
    return {
        "status": "evaluated",
        "model": MODEL,
        "detections": detections,
        "limitations": "Detección visual experimental; no confirma ausencia ni desalineación clínica.",
        "overlay_url": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"),
    }
