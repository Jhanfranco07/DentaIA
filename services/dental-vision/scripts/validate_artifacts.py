"""Build-time validation, using ONNX only in the exporter/test image."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import onnx
from app.model import EXPECTED_SHA256, EXPECTED_SIZE, verify_weights
from app.onnx_model import OnnxDetector


def main():
    root = Path(__file__).resolve().parents[1]
    verify_weights(root / "models/best.pt")
    manifest = json.loads((root / "models/best.onnx.json").read_text())
    model_path = root / "models/best.onnx"
    with model_path.open("rb") as stream:
        assert hashlib.file_digest(stream, "sha256").hexdigest() == manifest["onnx_sha256"]
    assert manifest["source_sha256"] == EXPECTED_SHA256
    assert manifest["source_bytes"] == EXPECTED_SIZE
    assert manifest["repository"] == "https://github.com/Eeman1113/dental_study"
    assert manifest["commit"] == "f02596a0227b9eaf767b955cd67196236111a3d5"
    assert manifest["source_path"] == "best.pt"
    assert manifest["source_url"].endswith("/f02596a0227b9eaf767b955cd67196236111a3d5/best.pt")
    assert model_path.stat().st_size == manifest["bytes"]
    assert manifest["license"] == "AGPL-3.0"
    assert manifest["source_weights_license_declared"] == "AGPL-3.0"
    assert "MIT" in manifest["source_repository_code_license_declared"]
    assert manifest["dependencies"] == {
        "fastapi": "0.135.2", "starlette": "1.10.0", "pydantic": "2.14.2",
        "uvicorn": "0.42.0", "pillow": "12.1.1", "numpy": "2.4.6",
        "opencv-python-headless": "5.0.0.93", "onnxruntime": "1.24.4",
        "torch": "2.11.0+cpu", "torchvision": "0.26.0+cpu",
        "ultralytics-opencv-headless": "8.4.104", "onnx": "1.20.1", "onnxscript": "0.6.2",
    }
    graph = onnx.load(str(model_path), load_external_data=False)
    assert not any(t.external_data for t in graph.graph.initializer), "External weights would be missing from runtime"
    onnx.checker.check_model(graph)
    metadata = {entry.key: entry.value for entry in graph.metadata_props}
    assert "AGPL-3.0" in metadata.get("license", ""), "Export lost its license metadata"
    assert metadata["source_repository"] == manifest["repository"]
    assert metadata["source_commit"] == manifest["commit"]
    assert metadata["source_sha256"] == EXPECTED_SHA256
    assert metadata["classes"] == "0=d;1=D"
    detector = OnnxDetector(model_path)
    assert detector.session.get_providers() == ["CPUExecutionProvider"]
    print(json.dumps({"verified": True, "source_sha256": EXPECTED_SHA256,
                      "onnx_sha256": manifest["onnx_sha256"], "onnx_bytes": manifest["bytes"],
                      "source_commit": manifest["commit"], "dependencies": manifest["dependencies"],
                      "embedded_weights": True, "license": metadata["license"]}))


if __name__ == "__main__":
    main()
