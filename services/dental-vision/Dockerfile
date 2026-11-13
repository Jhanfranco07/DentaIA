FROM python:3.11.9-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    MODEL_BACKEND=torch MODEL_PATH=models/best.pt \
    OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 \
    YOLO_AUTOINSTALL=false YOLO_CONFIG_DIR=/tmp/dentaia-yolo
WORKDIR /service
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts/download_model.py ./scripts/download_model.py
RUN python scripts/download_model.py
RUN useradd --create-home vision && chown -R vision:vision /service
USER vision
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --limit-concurrency 4 --timeout-keep-alive 5 --no-access-log"]
