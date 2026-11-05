import asyncio
import hmac
import io
import logging
import os
import time
import warnings
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.model import TorchDetector

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 12_000_000
FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
logger = logging.getLogger("dental_vision")


class Box(BaseModel):
    x_min: float = Field(ge=0, le=1)
    y_min: float = Field(ge=0, le=1)
    x_max: float = Field(ge=0, le=1)
    y_max: float = Field(ge=0, le=1)


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float = Field(ge=0, le=1)
    box: Box


class Prediction(BaseModel):
    model: str = "dental_study-yolo11m"
    width: int
    height: int
    inference_ms: float
    detections: list[Detection]


def decode_image(data: bytes, media_type: str):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format != FORMATS[media_type]:
                    raise HTTPException(415, "Content-Type does not match image format")
                if getattr(source, "n_frames", 1) != 1:
                    raise HTTPException(422, "Animated images are unsupported")
                if source.width * source.height > MAX_PIXELS:
                    raise HTTPException(413, "Image exceeds pixel limit")
                source.verify()
            with Image.open(io.BytesIO(data)) as source:
                source.load()
                ImageOps.exif_transpose(source, in_place=True)
                return source.copy() if source.mode == "RGB" else source.convert("RGB")
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(413, "Image exceeds pixel limit") from None
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise HTTPException(422, "Invalid or truncated image") from None


def create_app(detector_factory=None):
    @asynccontextmanager
    async def lifespan(app):
        secret = os.environ.get("DENTAL_VISION_SERVICE_SECRET", "")
        if len(secret.encode()) < 32 or not secret.isascii():
            raise RuntimeError("DENTAL_VISION_SERVICE_SECRET must be ASCII and at least 32 bytes")
        app.state.secret = secret
        app.state.detector = None
        app.state.busy = asyncio.Lock()
        backend = os.environ.get("MODEL_BACKEND", "onnx")
        if backend not in ("torch", "onnx"):
            raise RuntimeError("MODEL_BACKEND must be torch or onnx")
        app.state.backend = backend
        started = time.perf_counter()
        try:
            factory = detector_factory
            if factory is None:
                if backend == "onnx":
                    from app.onnx_model import OnnxDetector
                    factory = OnnxDetector
                else:
                    factory = TorchDetector
            default_path = "models/best.onnx" if backend == "onnx" else "models/best.pt"
            path = Path(os.environ.get("MODEL_PATH", default_path))
            app.state.detector = await run_in_threadpool(factory, path)
        except Exception:
            # Do not log paths, secrets, bodies or exception strings.
            logger.error("Model unavailable; check verified weights and runtime dependencies")
        app.state.model_load_seconds = round(time.perf_counter() - started, 6)
        yield
        app.state.detector = None

    app = FastAPI(title="DentaIA dental vision PoC", lifespan=lifespan,
                  docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def privacy_headers(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/health")
    async def health():
        from fastapi.responses import JSONResponse
        available = app.state.detector is not None
        return JSONResponse({"status": "ok" if available else "degraded",
                             "model_available": available, "device": "cpu",
                             "backend": app.state.backend,
                             "model_load_seconds": app.state.model_load_seconds},
                            status_code=200 if available else 503)

    @app.post("/predict", response_model=Prediction)
    async def predict(request: Request):
        supplied = request.headers.get("x-service-secret", "")
        if not hmac.compare_digest(supplied.encode(), app.state.secret.encode()):
            raise HTTPException(401, "Invalid service credentials")
        if app.state.detector is None:
            raise HTTPException(503, "Model unavailable")
        media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
        if media_type not in FORMATS:
            raise HTTPException(415, "Send raw JPEG, PNG or WebP bytes")
        length = request.headers.get("content-length")
        if length is not None:
            try:
                size = int(length)
            except ValueError:
                raise HTTPException(400, "Invalid Content-Length") from None
            if size < 0:
                raise HTTPException(400, "Invalid Content-Length")
            if size > MAX_BYTES:
                raise HTTPException(413, "Image exceeds byte limit")
        if app.state.busy.locked():
            raise HTTPException(429, "Service busy", headers={"Retry-After": "2"})
        async with app.state.busy:
            data = bytearray()
            async for chunk in request.stream():
                if len(data) + len(chunk) > MAX_BYTES:
                    raise HTTPException(413, "Image exceeds byte limit")
                data.extend(chunk)
            image = await run_in_threadpool(decode_image, bytes(data), media_type)
            data.clear()
            try:
                started = time.perf_counter()
                detections = await run_in_threadpool(app.state.detector.predict, image)
                elapsed = (time.perf_counter() - started) * 1000
                return Prediction(width=image.width, height=image.height,
                                  inference_ms=round(elapsed, 3), detections=detections)
            except Exception:
                logger.error("Inference failed")
                raise HTTPException(503, "Inference unavailable") from None
            finally:
                image.close()

    return app


app = create_app()
