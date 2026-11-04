"""CPU ONNX backend of the verified YOLO11m export; no Torch dependency."""
import hashlib
import json
import os
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from app.model import EXPECTED_SHA256


def preprocess(image):
    width, height = image.size
    ratio = min(640 / width, 640 / height)
    resized = (round(width * ratio), round(height * ratio))
    left, top = round((640 - resized[0]) / 2 - 0.1), round((640 - resized[1]) / 2 - 0.1)
    canvas = np.full((640, 640, 3), 114, dtype=np.uint8)
    canvas[top:top + resized[1], left:left + resized[0]] = cv2.resize(
        np.asarray(image), resized, interpolation=cv2.INTER_LINEAR)
    tensor = canvas.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    return np.ascontiguousarray(tensor), ratio, left, top


def postprocess(output, width, height, ratio, left, top):
    rows = output[0].T
    assert rows.shape[1] == 6, f"Unexpected YOLO11 output shape: {output.shape}"
    labels = rows[:, 4:].argmax(axis=1)
    scores = rows[:, 4:].max(axis=1)
    valid = scores >= 0.25
    rows, labels, scores = rows[valid], labels[valid], scores[valid]
    boxes = np.column_stack((rows[:, 0] - rows[:, 2] / 2, rows[:, 1] - rows[:, 3] / 2,
                             rows[:, 0] + rows[:, 2] / 2, rows[:, 1] + rows[:, 3] / 2))
    order = scores.argsort()[::-1]
    keep = []
    while len(order) and len(keep) < 100:
        current = order[0]
        keep.append(current)
        rest = order[1:]
        a = boxes[current]
        b = boxes[rest]
        intersections = np.maximum(0, np.minimum(a[2:], b[:, 2:]) - np.maximum(a[:2], b[:, :2])).prod(axis=1)
        area_a = np.maximum(0, a[2:] - a[:2]).prod()
        area_b = np.maximum(0, b[:, 2:] - b[:, :2]).prod(axis=1)
        iou = intersections / np.maximum(area_a + area_b - intersections, 1e-9)
        order = rest[(iou <= 0.45) | (labels[rest] != labels[current])]
    results = []
    for idx in keep:
        box = boxes[idx].copy()
        box[[0, 2]] = (box[[0, 2]] - left) / ratio / width
        box[[1, 3]] = (box[[1, 3]] - top) / ratio / height
        box = np.clip(box, 0, 1)
        results.append({"class_id": int(labels[idx]), "class_name": ("d", "D")[labels[idx]],
                        "confidence": float(scores[idx]),
                        "box": dict(zip(("x_min", "y_min", "x_max", "y_max"), map(float, box)))})
    return results


class OnnxDetector:
    def __init__(self, path: Path):
        manifest_path = Path(os.environ.get("MODEL_MANIFEST_PATH", str(path) + ".json"))
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest["source_sha256"] != EXPECTED_SHA256 or manifest["imgsz"] != 640
                or manifest["dynamic"] or manifest["nms"] or manifest["opset"] != 17
                or manifest["classes"] != {"0": "d", "1": "D"}):
            raise ValueError("Unrecognized ONNX provenance")
        if path.stat().st_size != manifest["bytes"]:
            raise ValueError("ONNX size mismatch")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != manifest["onnx_sha256"]:
            raise ValueError("ONNX checksum mismatch")
        cv2.setNumThreads(1)
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        self.session = ort.InferenceSession(str(path), sess_options=options,
                                            providers=["CPUExecutionProvider"])
        if (self.session.get_inputs()[0].shape != [1, 3, 640, 640]
                or self.session.get_outputs()[0].shape != [1, 6, 8400]):
            raise ValueError("Unexpected ONNX graph shape")
        self.input_name = self.session.get_inputs()[0].name

    def predict(self, image):
        tensor, ratio, left, top = preprocess(image)
        output = self.session.run(None, {self.input_name: tensor})[0]
        return postprocess(output, image.width, image.height, ratio, left, top)
