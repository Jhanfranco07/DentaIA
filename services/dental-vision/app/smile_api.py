"""Local-only FastAPI entrypoint for the Smile V17 workflow."""
from __future__ import annotations

import io
import hmac
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.smile_v17 import analizar
from app.oral_basic import analyze as analyze_oral

logger = logging.getLogger("dentaia_smile")
MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 12_000_000
FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
SERVICE_SECRET_HEADER = "x-dentaia-smile-secret"


def requires_service_secret() -> bool:
    return os.environ.get("DENTAIA_SMILE_REQUIRE_SERVICE_SECRET", "").lower() == "true"


def has_valid_service_secret() -> bool:
    return len(os.environ.get("DENTAIA_SMILE_SERVICE_SECRET", "")) >= 32


def decode(data: bytes, media_type: str) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format != FORMATS[media_type] or getattr(source, "n_frames", 1) != 1:
                raise HTTPException(422, "Invalid image")
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(413, "Image exceeds pixel limit")
            source.load()
            return ImageOps.exif_transpose(source).convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise HTTPException(422, "Invalid or truncated image") from None


@asynccontextmanager
async def lifespan(_: FastAPI):
    if requires_service_secret() and not has_valid_service_secret():
        raise RuntimeError("DENTAIA_SMILE_SERVICE_SECRET must be at least 32 characters")
    yield


app = FastAPI(title="DentaIA Smile V17", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.middleware("http")
async def privacy_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
async def health():
    import os
    return {"status": "ok" if os.environ.get("ROBOFLOW_API_KEY") else "degraded", "model": "teeth-4coz7/1"}


@app.post("/analyze")
async def analyze(request: Request):
    expected_secret = os.environ.get("DENTAIA_SMILE_SERVICE_SECRET")
    if requires_service_secret() and not has_valid_service_secret():
        raise HTTPException(503, "Smile service is not configured")
    if expected_secret and not hmac.compare_digest(
        request.headers.get(SERVICE_SECRET_HEADER, ""), expected_secret
    ):
        raise HTTPException(401, "Unauthorized")
    media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if media_type not in FORMATS:
        raise HTTPException(415, "Send raw JPEG, PNG or WebP bytes")
    data = await request.body()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds byte limit")
    image = await run_in_threadpool(decode, data, media_type)
    try:
        smile = await run_in_threadpool(analizar, image)
        if os.environ.get("DENTAIA_ORAL_BASIC_ENABLED", "").lower() == "true":
            try:
                smile["oral_analysis"] = await run_in_threadpool(analyze_oral, image)
            except Exception:
                logger.warning("Optional oral basic inference unavailable", exc_info=False)
                smile["oral_analysis"] = {
                    "status": "unavailable", "model": "oral-disease-union-xfe9b/8",
                    "detections": [], "limitations": "El análisis de posición no está disponible.",
                }
        return smile
    except HTTPException:
        raise
    except Exception:
        logger.exception("Smile analysis failed without logging image data")
        raise HTTPException(503, "Smile analysis unavailable") from None
    finally:
        image.close()
