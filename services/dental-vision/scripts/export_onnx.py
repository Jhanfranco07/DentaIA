"""Offline export evaluation; never exports or downloads during a request."""
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.model import TorchDetector, EXPECTED_SHA256


def main():
    os.chdir(Path(__file__).resolve().parents[1])
    detector = TorchDetector(Path("models/best.pt"))
    exported = Path(detector.model.export(format="onnx", imgsz=640, batch=1,
                    dynamic=False, simplify=False, opset=17, device="cpu", half=False,
                    nms=False))
    manifest = {"source_sha256": EXPECTED_SHA256, "onnx_sha256": hashlib.sha256(exported.read_bytes()).hexdigest(),
                "bytes": exported.stat().st_size, "imgsz": 640, "opset": 17,
                "dynamic": False, "nms": False, "classes": {0: "d", 1: "D"}}
    Path("evidence/onnx-export.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    exported.with_suffix(".onnx.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
