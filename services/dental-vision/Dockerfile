FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DENTAIA_SMILE_REQUIRE_SERVICE_SECRET=true

WORKDIR /app

# OpenCV needs these runtime libraries in the slim Debian image.
RUN apt-get update \
    && apt-get install --no-install-recommends -y libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 7862

# Railway provides PORT. Refuse to start a remote container that would expose
# /analyze without the service-to-service credential.
CMD ["sh", "-ec", "secret=${DENTAIA_SMILE_SERVICE_SECRET:-}; if [ ${#secret} -lt 32 ]; then echo 'DENTAIA_SMILE_SERVICE_SECRET must be at least 32 characters' >&2; exit 1; fi; exec uvicorn app.smile_api:app --host 0.0.0.0 --port ${PORT:-7862}"]
