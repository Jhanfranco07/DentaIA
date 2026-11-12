"""Authenticated image-validation endpoint for a clearly labeled simulation.

This module intentionally does not import or load any model or inference code.
"""
import asyncio
import hmac
import io
import os
import warnings
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 12_000_000
FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def _secret_is_valid(secret: str) -> bool:
    return secret.isascii() and len(secret.encode("ascii")) >= 32


def _validate_image(data: bytes, media_type: str) -> None:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format != FORMATS[media_type]:
                    raise HTTPException(415, "Content-Type does not match image format")
                if getattr(image, "n_frames", 1) != 1:
                    raise HTTPException(422, "Animated images are unsupported")
                if image.width * image.height > MAX_PIXELS:
                    raise HTTPException(413, "Image exceeds pixel limit")
                image.verify()
    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(413, "Image exceeds pixel limit") from None
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise HTTPException(422, "Invalid or truncated image") from None


@asynccontextmanager
async def lifespan(app: FastAPI):
    secret = os.environ.get("DENTAL_VISION_SERVICE_SECRET", "")
    if not _secret_is_valid(secret):
        raise RuntimeError("DENTAL_VISION_SERVICE_SECRET must be ASCII and at least 32 bytes")
    app.state.secret = secret
    app.state.busy = asyncio.Lock()
    yield


app = FastAPI(
    title="DentaIA Vision evaluation simulation",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)


@app.middleware("http")
async def privacy_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok", "mode": "simulation", "model_loaded": False})


@app.post("/predict")
async def predict(request: Request):
    supplied = request.headers.get("x-service-secret", "")
    expected = getattr(request.app.state, "secret", "")
    if not expected or not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(401, "Invalid service credentials")

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

    busy = request.app.state.busy
    if busy.locked():
        raise HTTPException(429, "Service busy", headers={"Retry-After": "2"})

    async with busy:
        data = bytearray()
        async for chunk in request.stream():
            if len(data) + len(chunk) > MAX_BYTES:
                raise HTTPException(413, "Image exceeds byte limit")
            data.extend(chunk)
        _validate_image(bytes(data), media_type)

    return {
        "status": "simulation",
        "simulated": True,
        "model": None,
        "predictions": [],
        "message": "Simulation only: no ONNX inference, prediction, or diagnosis was performed.",
    }
