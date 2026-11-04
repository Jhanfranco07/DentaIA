"""HTTP integration with an explicit fake detector: NOT evidence of real inference."""
import io
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import MAX_BYTES, create_app, decode_image
from app.model import verify_weights

SECRET = "test-only-secret-" * 3
HEADERS = {"x-service-secret": SECRET, "content-type": "image/png"}


class FakeDetector:
    loads = 0

    def __init__(self, path):
        FakeDetector.loads += 1

    def predict(self, image):
        return [{"class_id": 0, "class_name": "d", "confidence": 0.8,
                 "box": {"x_min": 0.1, "y_min": 0.2, "x_max": 0.3, "y_max": 0.4}}]


def image_bytes(fmt="PNG", size=(64, 32)):
    stream = io.BytesIO()
    Image.new("RGB", size, "white").save(stream, format=fmt)
    return stream.getvalue()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DENTAL_VISION_SERVICE_SECRET", SECRET)
    with TestClient(create_app(FakeDetector)) as client:
        yield client


@pytest.mark.parametrize("fmt,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_formats_and_normalized_contract_with_mock(client, fmt, mime):
    response = client.post("/predict", content=image_bytes(fmt),
                           headers={**HEADERS, "content-type": mime})
    assert response.status_code == 200
    result = response.json()
    assert (result["width"], result["height"]) == (64, 32)
    assert result["detections"][0]["class_name"] == "d"
    assert all(0 <= v <= 1 for v in result["detections"][0]["box"].values())
    assert response.headers["cache-control"] == "no-store"


def test_load_once_and_health_with_mock(client):
    loads = FakeDetector.loads
    for _ in range(2):
        assert client.post("/predict", content=image_bytes(), headers=HEADERS).status_code == 200
    assert FakeDetector.loads == loads
    assert client.get("/health").json()["model_available"] is True


def test_unauthorized_before_body_validation(client):
    assert client.post("/predict", content=b"invalid").status_code == 401
    assert client.post("/predict", headers={"x-service-secret": "wrong"}).status_code == 401


@pytest.mark.parametrize("body,mime,status", [(b"", "image/png", 422),
    (b"not an image", "image/png", 422), (image_bytes(), "image/jpeg", 415),
    (b"gif", "image/gif", 415), (image_bytes()[:30], "image/png", 422)])
def test_reject_invalid_images(client, body, mime, status):
    assert client.post("/predict", content=body,
                       headers={**HEADERS, "content-type": mime}).status_code == status


def test_byte_limit_and_stream_without_length(client):
    assert client.post("/predict", content=b"x", headers={**HEADERS,
                       "content-length": str(MAX_BYTES + 1)}).status_code == 413
    def chunks():
        for _ in range(9):
            yield b"x" * 1024 * 1024
    assert client.post("/predict", content=chunks(), headers=HEADERS).status_code == 413


def test_pixel_limit_unit():
    with pytest.raises(Exception) as error:
        decode_image(image_bytes(size=(4000, 3100)), "image/png")
    assert error.value.status_code == 413


def test_lfs_pointer_rejected_unit(tmp_path):
    path = tmp_path / "best.pt"
    path.write_text("version https://git-lfs.github.com/spec/v1\n")
    with pytest.raises(ValueError):
        verify_weights(path)


def test_missing_model_is_unavailable(monkeypatch):
    monkeypatch.setenv("DENTAL_VISION_SERVICE_SECRET", SECRET)
    def missing(path):
        raise FileNotFoundError()
    with TestClient(create_app(missing)) as client:
        assert client.get("/health").status_code == 503
        assert client.get("/health").json()["model_available"] is False
        assert client.post("/predict", content=image_bytes(), headers=HEADERS).status_code == 503


def test_missing_secret_fails_closed(monkeypatch):
    monkeypatch.delenv("DENTAL_VISION_SERVICE_SECRET", raising=False)
    with pytest.raises(RuntimeError):
        with TestClient(create_app(FakeDetector)):
            pass


def test_inference_error_is_not_a_detection(monkeypatch):
    monkeypatch.setenv("DENTAL_VISION_SERVICE_SECRET", SECRET)
    class Broken(FakeDetector):
        def predict(self, image):
            raise RuntimeError("private internal detail")
    with TestClient(create_app(Broken)) as client:
        response = client.post("/predict", content=image_bytes(), headers=HEADERS)
        assert response.status_code == 503
        assert "private" not in response.text


def test_busy_returns_429_and_health_remains_responsive(monkeypatch):
    monkeypatch.setenv("DENTAL_VISION_SERVICE_SECRET", SECRET)
    entered, release = threading.Event(), threading.Event()
    class Slow(FakeDetector):
        def predict(self, image):
            entered.set()
            assert release.wait(10)
            return []
    with TestClient(create_app(Slow)) as client, ThreadPoolExecutor() as pool:
        future = pool.submit(client.post, "/predict", content=image_bytes(), headers=HEADERS)
        try:
            assert entered.wait(10)
            assert client.get("/health").status_code == 200
            assert client.post("/predict", content=image_bytes(), headers=HEADERS).status_code == 429
        finally:
            release.set()
        assert future.result().status_code == 200


def test_animation_rejected(client):
    output = io.BytesIO()
    frames = [Image.new("RGB", (20, 20), color) for color in ("red", "blue")]
    frames[0].save(output, format="WEBP", save_all=True, append_images=frames[1:], duration=100)
    assert client.post("/predict", content=output.getvalue(), headers={
        **HEADERS, "content-type": "image/webp"}).status_code == 422


def test_service_does_not_write_uploaded_photos(client, monkeypatch):
    payload = image_bytes()
    def forbidden_save(*args, **kwargs):
        raise AssertionError("API attempted to save image")
    monkeypatch.setattr(Image.Image, "save", forbidden_save)
    assert client.post("/predict", content=payload, headers=HEADERS).status_code == 200
