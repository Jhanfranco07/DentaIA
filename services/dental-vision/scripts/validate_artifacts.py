"""Build-time validation, using ONNX only in the exporter/test image."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import onnx
from app.model import EXPECTED_SHA256, verify_weights
from app.onnx_model import OnnxDetector


def main():
    root = Path(__file__).resolve().parents[1]
    verify_weights(root / "models/best.pt")
    manifest = json.loads((root / "models/best.onnx.json").read_text())
    model_path = root / "models/best.onnx"
    with model_path.open("rb") as stream:
        assert hashlib.file_digest(stream, "sha256").hexdigest() == manifest["onnx_sha256"]
    assert manifest["source_sha256"] == EXPECTED_SHA256
    assert model_path.stat().st_size == manifest["bytes"]
    assert manifest["license"] == "AGPL-3.0"
    graph = onnx.load(str(model_path), load_external_data=False)
    assert not any(t.external_data for t in graph.graph.initializer), "External weights would be missing from runtime"
    onnx.checker.check_model(graph)
    metadata = {entry.key: entry.value for entry in graph.metadata_props}
    assert "AGPL-3.0" in metadata.get("license", ""), "Export lost its license metadata"
    detector = OnnxDetector(model_path)
    assert detector.session.get_providers() == ["CPUExecutionProvider"]
    print(json.dumps({"verified": True, "source_sha256": EXPECTED_SHA256,
                      "onnx_sha256": manifest["onnx_sha256"], "onnx_bytes": manifest["bytes"],
                      "embedded_weights": True, "license": metadata["license"]}))


if __name__ == "__main__":
    main()
