"""REAL integration. Opt in explicitly; never falls back to a mock or synthetic image."""
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.mark.real
@pytest.mark.skipif(os.environ.get("RUN_REAL_INFERENCE") != "1", reason="Explicit opt-in required")
@pytest.mark.parametrize("backend", ["torch", "onnx"])
def test_real_model_and_http(monkeypatch, backend):
    secret = "real-integration-test-secret-" * 2
    monkeypatch.setenv("DENTAL_VISION_SERVICE_SECRET", secret)
    monkeypatch.setenv("MODEL_BACKEND", backend)
    monkeypatch.delenv("MODEL_PATH", raising=False)
    manifest = json.loads(Path("evidence/samples.json").read_text())
    with TestClient(create_app()) as client:
        assert client.get("/health").json()["model_available"] is True
        for sample in manifest["files"]:
            data = (Path("evidence/private") / sample["name"]).read_bytes()
            response = client.post("/predict", content=data, headers={
                "x-service-secret": secret, "content-type": "image/jpeg"})
            assert response.status_code == 200, response.text
            result = response.json()
            assert result["width"] > 0 and result["inference_ms"] > 0
            for detection in result["detections"]:
                assert detection["class_name"] in ("d", "D")
                box = detection["box"]
                assert 0 <= box["x_min"] <= box["x_max"] <= 1
                assert 0 <= box["y_min"] <= box["y_max"] <= 1
            # No assertion that lesions must exist: zero detections is a valid real result.
