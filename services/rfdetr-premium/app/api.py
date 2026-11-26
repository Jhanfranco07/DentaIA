"""Independent FastAPI boundary. Disabled until explicitly enabled at deployment."""
from __future__ import annotations

import hmac
import io
import logging
import os
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from .model import predict

logger = logging.getLogger("dentaia_rfdetr")
app = FastAPI(title="DentaIA RF-DETR Premium", docs_url=None, redoc_url=None, openapi_url=None)
MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 12_000_000
FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
_inference_lock = Lock()
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def enabled() -> bool:
    return (os.environ.get("DENTAIA_RFDETR_ENABLED") == "true"
            and (os.environ.get("DENTAIA_ENV") in {"local", "test"}
                 or os.environ.get("DENTAIA_RFDETR_PRODUCTION_ENABLED") == "true"))


def authenticate(request: Request) -> None:
    if not enabled():
        raise HTTPException(503, "Premium inference disabled")
    secret = os.environ.get("DENTAIA_RFDETR_SERVICE_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(503, "Premium service is not configured")
    supplied = request.headers.get("x-dentaia-rfdetr-secret", "")
    if not hmac.compare_digest(supplied, secret):
        raise HTTPException(401, "Unauthorized")


async def read_bounded(request: Request) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length and (len(content_length) > 12 or not content_length.isdecimal()
                           or int(content_length) > MAX_BYTES):
        raise HTTPException(413, "Image exceeds byte limit")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "Image exceeds byte limit")
    if not data:
        raise HTTPException(413, "Empty image")
    return bytes(data)


def decode(data: bytes, media_type: str) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format != FORMATS[media_type] or getattr(source, "n_frames", 1) != 1:
                raise HTTPException(422, "Invalid image")
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(413, "Image exceeds pixel limit")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
            if image.width * image.height > MAX_PIXELS:
                image.close()
                raise HTTPException(413, "Image exceeds pixel limit")
            return image
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(422, "Invalid or truncated image") from None


@app.middleware("http")
async def privacy_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
async def health():
    # Configuration alone does not prove that the checkpoint loaded successfully.
    return {"status": "configured" if enabled() and len(os.environ.get("DENTAIA_RFDETR_SERVICE_SECRET", "")) >= 32 else "disabled"}


@app.post("/analyze")
async def analyze(request: Request):
    authenticate(request)  # Before image bytes are read.
    media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if media_type not in FORMATS:
        raise HTTPException(415, "Send raw JPEG, PNG or WebP bytes")
    data = await read_bounded(request)
    image = await run_in_threadpool(decode, data, media_type)
    if not _inference_lock.acquire(blocking=False):
        image.close()
        raise HTTPException(429, "Premium inference busy")
    try:
        return await run_in_threadpool(predict, image)
    except Exception:
        logger.error("Premium inference unavailable; no image or model internals logged")
        raise HTTPException(503, "Premium inference unavailable") from None
    finally:
        image.close()
        _inference_lock.release()
