"""Contract tests for the isolated, no-model evaluation service."""
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.evaluation import MAX_BYTES, app

SECRET = "evaluation-test-secret-0123456789abcdef"
HEADERS = {"x-service-secret": SECRET, "content-type": "image/png"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DENTAL_VISION_SERVICE_SECRET", SECRET)
    with TestClient(app) as test_client:
        yield test_client


def png_bytes(size=(32, 24)):
    stream = io.BytesIO()
    Image.new("RGB", size, "white").save(stream, format="PNG")
    return stream.getvalue()


def test_health_is_explicitly_simulation(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "mode": "simulation", "model_loaded": False}


def test_predict_requires_secret_before_body(client):
    response = client.post("/predict", content=b"not an image")
    assert response.status_code == 401


def test_valid_image_returns_simulation_without_predictions(client):
    response = client.post("/predict", content=png_bytes(), headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "simulation"
    assert body["simulated"] is True
    assert body["model"] is None
    assert body["predictions"] == []
    assert "no ONNX inference" in body["message"]


def test_rejects_wrong_media_type_and_corrupt_image(client):
    assert client.post("/predict", content=b"x", headers={
        **HEADERS, "content-type": "image/gif"}).status_code == 415
    assert client.post("/predict", content=b"not png", headers=HEADERS).status_code == 422


def test_enforces_byte_and_pixel_limits(client):
    too_large = client.post("/predict", content=b"x", headers={
        **HEADERS, "content-length": str(MAX_BYTES + 1)})
    assert too_large.status_code == 413
    too_many_pixels = client.post("/predict", content=png_bytes((3500, 3500)), headers=HEADERS)
    assert too_many_pixels.status_code == 413


def test_missing_secret_fails_closed(monkeypatch):
    monkeypatch.delenv("DENTAL_VISION_SERVICE_SECRET", raising=False)
    with pytest.raises(RuntimeError):
        with TestClient(app):
            pass
