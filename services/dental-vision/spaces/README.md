---
title: DentaIA Vision API (PoC)
emoji: 🦷
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# DentaIA Vision API (PoC)

Servicio FastAPI de inferencia ONNX para evaluación técnica. Expone `GET /health` y `POST /predict`; este último requiere `X-Service-Secret`. Configura `DENTAL_VISION_SERVICE_SECRET` como secreto del Space antes de habilitar inferencias. No guardes el secreto en este repositorio ni lo envíes desde código de navegador.

Las clases `d` y `D` son etiquetas literales del modelo. Las salidas son orientativas y no constituyen diagnóstico ni recomendación clínica.

## Estado de publicación

La revisión de licencia sigue pendiente. `LICENSE_REVIEW.md` identifica obligaciones AGPL relacionadas con los pesos y el servicio. No publiques ni habilites acceso a este Space hasta resolverlas. El build descarga los pesos fijados por el script y genera el ONNX dentro de la imagen; no subas pesos ni archivos ONNX al repositorio.

## Crear un repositorio de preparación aislado

En un repositorio Hugging Face vacío ya creado como Docker Space, ejecuta desde PowerShell en este checkout:

```powershell
./services/dental-vision/scripts/prepare_hf_space.ps1 -DestinationPath "C:/ruta/al/clon-vacio-del-space"
```

El script copia únicamente el Dockerfile ONNX como `Dockerfile`, este README como `README.md`, dependencias de exportación/runtime, código FastAPI y scripts de descarga/exportación/validación, `.dockerignore` y avisos de licencia. No copia modelos, imágenes, `.env`, secretos, evidencia ni entornos virtuales. Revisa el repositorio aislado antes de cualquier publicación.

Para ejecutar localmente el Dockerfile ONNX en el puerto histórico, conserva `-e PORT=10000` y publica `-p 10000:10000`. El Dockerfile PyTorch `Dockerfile` original y el arranque local de Uvicorn no cambian.

## Contrato

- `GET /health`: estado del modelo, sin autenticación, apto para health check.
- `POST /predict`: bytes JPEG/PNG/WebP y cabecera `X-Service-Secret`; conserva los límites y respuestas definidos por el servicio.
- El servicio no guarda imágenes ni resultados.
