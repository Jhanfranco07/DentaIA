"""Offline export evaluation; never exports or downloads during a request."""
import hashlib
import importlib.metadata
import json
import os
import platform
import sys
from pathlib import Path
import onnx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.model import TorchDetector, EXPECTED_SHA256

SOURCE_REPOSITORY = "https://github.com/Eeman1113/dental_study"
SOURCE_COMMIT = "f02596a0227b9eaf767b955cd67196236111a3d5"
SOURCE_PATH = "best.pt"
SOURCE_URL = f"https://media.githubusercontent.com/media/Eeman1113/dental_study/{SOURCE_COMMIT}/{SOURCE_PATH}"


def distribution_versions():
    names = ("fastapi", "starlette", "pydantic", "uvicorn", "pillow", "numpy",
             "opencv-python-headless", "onnxruntime", "torch", "torchvision",
             "ultralytics-opencv-headless", "onnx", "onnxscript")
    return {name: importlib.metadata.version(name) for name in names}


def main():
    os.chdir(Path(__file__).resolve().parents[1])
    detector = TorchDetector(Path("models/best.pt"))
    exported = Path(detector.model.export(format="onnx", imgsz=640, batch=1,
                    dynamic=False, simplify=False, opset=17, device="cpu", half=False,
                    nms=False))
    graph = onnx.load(str(exported), load_external_data=False)
    metadata = {item.key: item.value for item in graph.metadata_props}
    metadata.update({"license": "AGPL-3.0", "source_repository": SOURCE_REPOSITORY,
                     "source_commit": SOURCE_COMMIT, "source_path": SOURCE_PATH,
                     "source_sha256": EXPECTED_SHA256, "classes": "0=d;1=D"})
    onnx.helper.set_model_props(graph, metadata)
    onnx.save(graph, str(exported))
    source = Path("models/best.pt")
    manifest = {
        "repository": SOURCE_REPOSITORY,
        "commit": SOURCE_COMMIT,
        "source_path": SOURCE_PATH,
        "source_url": SOURCE_URL,
        "source_bytes": source.stat().st_size,
        "source_sha256": EXPECTED_SHA256,
        "source_weights_license_declared": "AGPL-3.0",
        "source_repository_code_license_declared": "MIT (upstream README declaration; separate LICENSE not verified)",
        "license": "AGPL-3.0",
        "onnx_sha256": hashlib.sha256(exported.read_bytes()).hexdigest(),
        "bytes": exported.stat().st_size,
        "imgsz": 640,
        "opset": 17,
        "dynamic": False,
        "nms": False,
        "classes": {0: "d", 1: "D"},
        "python": platform.python_version(),
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "export": "FP32; CPU; fixed 640 input; no simplification, NMS or quantization",
        "dependencies": distribution_versions(),
        "dependency_scope": "direct runtime/export distributions; transitive and OS packages require a separate SBOM",
        "notice_files": ["LICENSE_REVIEW.md", "third_party/AGPL-3.0.txt"],
    }
    Path("evidence").mkdir(parents=True, exist_ok=True)
    Path("evidence/onnx-export.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    exported.with_suffix(".onnx.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
