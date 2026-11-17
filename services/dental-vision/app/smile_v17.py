"""DentaIA Smile V17 processing, ported without changing its visual rules.

The functions below deliberately retain the Colab model, CIELAB conversion,
polygon filtering, thresholds, erosion, morphology and contour drawing.
"""
from __future__ import annotations

import base64
import io
import json
import os
import time
import urllib.parse
import urllib.request

import cv2
import numpy as np
from PIL import Image

MODEL = "teeth-4coz7/1"
ROBOFLOW_URL = f"https://serverless.roboflow.com/{MODEL}"
CFG = {
    "max_dimension": 1200,
    "l_min": 35.0, "l_max": 98.0,
    "min_pixels": 80, "min_usable_fraction": 0.35,
    "b_low": 15.0, "b_medium": 23.0, "b_high": 31.0,
    "partial_delta_halves": 5.0,
    "partial_delta_pixel": 6.0,
    "partial_min_fraction": 0.04,
    "partial_max_fraction": 0.70,
    "partial_min_component": 35,
    "light_difference_warning": 12.0,
}
GREEN, YELLOW, ORANGE, RED, GRAY = (
    (30, 205, 80), (250, 220, 50), (255, 145, 0),
    (220, 75, 45), (145, 145, 145),
)


def segmentar_roboflow(imagen: Image.Image) -> dict:
    api_key = os.environ.get("ROBOFLOW_API_KEY", "")
    if not api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not configured")
    buf = io.BytesIO()
    imagen.save(buf, format="JPEG", quality=95)
    params = urllib.parse.urlencode({"api_key": api_key, "confidence": 50, "overlap": 50})
    req = urllib.request.Request(
        ROBOFLOW_URL + "?" + params,
        data=base64.b64encode(buf.getvalue()),
        headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as response:  # nosec B310: fixed HTTPS endpoint
        return json.loads(response.read().decode("utf-8"))


def extraer_dientes(rgb: np.ndarray, respuesta: dict) -> list[dict]:
    h, w = rgb.shape[:2]
    meta = respuesta.get("image") or {}
    sx, sy = w / float(meta.get("width") or w), h / float(meta.get("height") or h)
    dientes = []
    for pred in respuesta.get("predictions", []):
        if str(pred.get("class", "")).lower() not in ("tooth", "teeth"):
            continue
        puntos = pred.get("points") or []
        if len(puntos) < 3:
            continue
        try:
            pts = np.array([[float(p["x"]) * sx, float(p["y"]) * sy] for p in puntos], dtype=np.float32)
        except (ValueError, TypeError, KeyError):
            continue
        pts[:, 0], pts[:, 1] = np.clip(pts[:, 0], 0, w - 1), np.clip(pts[:, 1], 0, h - 1)
        polygon = np.rint(pts).astype(np.int32)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillPoly(mask, [polygon], 255)
        ys, xs = np.where(mask > 0)
        if len(xs) < 50:
            continue
        dientes.append({"polygon": polygon, "mask": mask > 0, "x": float(np.median(xs)), "y": float(np.median(ys)), "area": len(xs)})
    if len(dientes) >= 4:
        areas, yvals = np.array([d["area"] for d in dientes], dtype=float), np.array([d["y"] for d in dientes], dtype=float)
        med_area, med_y, mad_y = np.median(areas), np.median(yvals), np.median(np.abs(yvals - np.median(yvals)))
        dientes = [d for d in dientes if d["area"] <= 4 * med_area and abs(d["y"] - med_y) <= max(4 * mad_y, h * 0.12)]
    dientes.sort(key=lambda d: d["x"])
    for i, diente in enumerate(dientes, 1):
        diente["id"] = i
    return dientes


def nivel_amarillo(b: float) -> tuple[str, tuple[int, int, int]]:
    if b >= CFG["b_high"]: return "Intenso", RED
    if b >= CFG["b_medium"]: return "Moderado", ORANGE
    if b >= CFG["b_low"]: return "Leve", YELLOW
    return "Sin amarillo destacado", GREEN


def analizar_color(rgb: np.ndarray, dientes: list[dict]) -> None:
    lab = cv2.cvtColor(rgb.astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB)
    l_channel, b_channel = lab[:, :, 0], lab[:, :, 2]
    h, w = b_channel.shape
    for diente in dientes:
        mask = cv2.erode(diente["mask"].astype(np.uint8) * 255, np.ones((3, 3), np.uint8), iterations=2) > 0
        valid = mask & (l_channel >= CFG["l_min"]) & (l_channel <= CFG["l_max"])
        count = int(valid.sum())
        evaluable = count >= CFG["min_pixels"] and count / max(int(mask.sum()), 1) >= CFG["min_usable_fraction"]
        diente.update({"evaluable": bool(evaluable), "b_median": None, "level": "No evaluable", "delta_b_halves": None,
                       "delta_l_halves": None, "light_warning": False, "partial": False, "zone_fraction": 0.0,
                       "zone": np.zeros((h, w), dtype=bool), "zone_level": None, "valid_pixels": count,
                       "valid_fraction": count / max(int(mask.sum()), 1)})
        if not evaluable:
            continue
        bmed = float(np.median(b_channel[valid]))
        diente["b_median"] = bmed
        diente["level"], _ = nivel_amarillo(bmed)
        _, xs = np.where(valid)
        middle = (float(xs.min()) + float(xs.max())) / 2
        left, right = valid & (np.arange(w)[None, :] < middle), valid & (np.arange(w)[None, :] >= middle)
        if min(int(left.sum()), int(right.sum())) >= 40:
            diente["delta_b_halves"] = abs(float(np.median(b_channel[left])) - float(np.median(b_channel[right])))
            diente["delta_l_halves"] = abs(float(np.median(l_channel[left])) - float(np.median(l_channel[right])))
            diente["light_warning"] = diente["delta_l_halves"] > CFG["light_difference_warning"]
        can_localize = diente["delta_b_halves"] is not None and diente["delta_b_halves"] >= CFG["partial_delta_halves"] and not diente["light_warning"]
        if not can_localize:
            continue
        ref_b = float(np.percentile(b_channel[valid], 25))
        threshold = max(CFG["b_low"], ref_b + CFG["partial_delta_pixel"])
        candidates = (valid & (b_channel >= threshold)).astype(np.uint8) * 255
        candidates = cv2.morphologyEx(candidates, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        candidates = cv2.morphologyEx(candidates, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        candidates[~valid] = 0
        nlab, lab_img, stats, _ = cv2.connectedComponentsWithStats(candidates, connectivity=8)
        min_area = max(CFG["partial_min_component"], int(count * CFG["partial_min_fraction"]))
        zone = np.zeros((h, w), dtype=bool)
        for i in range(1, nlab):
            if int(stats[i, cv2.CC_STAT_AREA]) >= min_area:
                zone |= lab_img == i
        frac = float(zone.sum()) / count
        if CFG["partial_min_fraction"] <= frac <= CFG["partial_max_fraction"]:
            diente["partial"], diente["zone"], diente["zone_fraction"] = True, zone, frac
            diente["zone_level"], _ = nivel_amarillo(float(np.median(b_channel[zone])))


def dibujar(rgb: np.ndarray, dientes: list[dict]) -> np.ndarray:
    output = rgb.copy()
    for diente in dientes:
        if not diente["partial"]: continue
        color = RED if diente["zone_level"] == "Intenso" else ORANGE if diente["zone_level"] == "Moderado" else YELLOW
        output[diente["zone"]] = (0.80 * output[diente["zone"]].astype(float) + 0.20 * np.array(color, dtype=float)).astype(np.uint8)
        contours, _ = cv2.findContours(diente["zone"].astype(np.uint8) * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(output, contours, -1, color, 2)
    for diente in dientes:
        color = GRAY if not diente["evaluable"] else (ORANGE if diente["partial"] and diente["zone_level"] != "Intenso" else RED if diente["partial"] else nivel_amarillo(float(diente["b_median"]))[1])
        cv2.polylines(output, [diente["polygon"]], True, color, 2)
        x, y = int(diente["x"]), int(diente["y"])
        cv2.putText(output, str(diente["id"]), (x - 7, y + 5), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(output, str(diente["id"]), (x - 7, y + 5), cv2.FONT_HERSHEY_SIMPLEX, .55, (255, 255, 255), 1, cv2.LINE_AA)
    return output


def analizar(imagen: Image.Image, roboflow_response: dict | None = None) -> dict:
    imagen.thumbnail((CFG["max_dimension"], CFG["max_dimension"]))
    rgb = np.asarray(imagen)
    started = time.perf_counter()
    inference_started = time.perf_counter()
    prediction = roboflow_response if roboflow_response is not None else segmentar_roboflow(imagen)
    inference_ms = round((time.perf_counter() - inference_started) * 1000, 3)
    dientes = extraer_dientes(rgb, prediction)
    analizar_color(rgb, dientes)
    overlay = dibujar(rgb, dientes)
    evaluable = sum(d["evaluable"] for d in dientes)
    regions = [{"region_id": d["id"], "label": "tooth", "evaluable": d["evaluable"], "reason": None if d["evaluable"] else "insufficient_valid_pixels",
                "valid_pixels": d["valid_pixels"], "valid_fraction": round(d["valid_fraction"], 6), "b_median": d["b_median"], "level": d["level"],
                "delta_b_halves": d["delta_b_halves"], "delta_l_halves": d["delta_l_halves"], "illumination_warning": d["light_warning"],
                "partial": d["partial"], "zone_fraction": round(d["zone_fraction"], 6), "zone_level": d["zone_level"]} for d in dientes]
    status = "not_evaluable" if not evaluable else "evaluable" if evaluable == len(dientes) else "partially_evaluable"
    regions_with_light_warning = sum(d["evaluable"] and d["light_warning"] for d in dientes)
    lighting_quality = "not_evaluable" if not evaluable else "review" if regions_with_light_warning else "adequate"
    warnings = []
    if not dientes:
        warnings.append("No se detectaron regiones dentales.")
    elif evaluable < len(dientes):
        warnings.append(f"{len(dientes) - evaluable} regiones no fueron evaluables.")
    if regions_with_light_warning:
        warnings.append(f"Se detectó iluminación desigual en {regions_with_light_warning} regiones evaluables.")
    encoded = cv2.imencode(".png", cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))[1].tobytes()
    return {"result": {"version": "V17", "model": MODEL, "status": status, "image_width": int(rgb.shape[1]), "image_height": int(rgb.shape[0]),
                        "inference_ms": inference_ms, "analysis_ms": round((time.perf_counter() - started) * 1000, 3), "thresholds": CFG.copy(),
                        "detected_regions": len(dientes), "evaluable_regions": evaluable, "lighting_quality": lighting_quality,
                        "regions": regions, "warnings": warnings,
                        "limitations": ["Niveles visuales experimentales; no constituyen diagnóstico clínico."]},
            "overlay_url": "data:image/png;base64," + base64.b64encode(encoded).decode("ascii")}
