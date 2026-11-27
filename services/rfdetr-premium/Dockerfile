FROM python:3.11-slim@sha256:61e01f72680f86a5279ad510818ab7b2ee9f049822589d4e34e33e044360356c

ENV PYTHONPATH=/opt/di211/site PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TORCH_FORCE_WEIGHTS_ONLY_LOAD=1 \
    DENTAIA_RFDETR_ENABLED=false

WORKDIR /app
COPY requirements.lock requirements-api.lock ./
RUN python -I -m pip install --require-hashes --no-deps --target /opt/di211/site \
      -r requirements.lock -r requirements-api.lock \
    && python -I -m pip uninstall --yes setuptools \
    && python -m pip check
RUN apt-get update -qq \
    && apt-get install --yes --no-install-recommends \
       libzstd1=1.5.7+dfsg-1+deb13u1 \
       login.defs=1:4.17.4-2+deb13u1 \
       passwd=1:4.17.4-2+deb13u1 \
    && rm -rf /var/lib/apt/lists/* \
    && python -I -m pip check \
    && python -I -m pip uninstall --yes pip
COPY app ./app
COPY config ./config
USER 65532:65532
EXPOSE 7863
CMD ["sh", "-ec", "exec python -m uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-7863} --workers 1 --limit-concurrency 2 --timeout-keep-alive 5 --no-access-log"]
