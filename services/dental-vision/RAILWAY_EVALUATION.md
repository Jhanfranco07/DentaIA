# Evaluación simulada en Railway

Esta variante sirve para comprobar el contenedor, el health check y el contrato HTTP **sin descargar ni cargar pesos**. `/predict` valida la imagen y responde `status: simulation`, `simulated: true`, `model: null` y `predictions: []`. No ejecuta ONNX ni devuelve predicciones o diagnósticos. No acepta fotos de pacientes en esta evaluación.

El `railway.json` del servicio apunta ahora a `Dockerfile.evaluation`. Configurar Root Directory `/services/dental-vision` y `DENTAL_VISION_SERVICE_SECRET` con un valor ASCII aleatorio de al menos 32 bytes. No hace falta configurar `MODEL_BACKEND`: esta aplicación no carga modelos. Railway inyecta `PORT`; el contenedor escucha en `0.0.0.0`. Health check: `/health`.

Para conexión futura desde Next.js, mantener las llamadas en el Route Handler del servidor, usar HTTPS y el mismo secreto del lado servidor; nunca usar `NEXT_PUBLIC_`. La ruta Next actual conserva su autenticación y su allowlist de dos imágenes demo.

## Comandos

Desde `services/dental-vision`:

```powershell
docker build -f Dockerfile.evaluation -t dentaia-vision:evaluation .
python -m pip install -r requirements-evaluation-test.txt
python -m pytest -q tests/test_evaluation.py
```

Para desplegar más adelante, tras resolver las restricciones de licencia y autorizar el despliegue, Railway debe usar Root Directory `/services/dental-vision` y `Dockerfile.evaluation`. El comando de CLI sería `railway up`; **no se ejecutó**. No desplegar públicamente ni cambiar a `Dockerfile.railway` hasta resolver `LICENSE_REVIEW.md`.

## Límites

- Esta es una simulación de transporte/validación de imágenes; no evalúa modelo, precisión, rendimiento de ONNX ni utilidad clínica.
- El Dockerfile instala solo FastAPI, Starlette, Pydantic, Uvicorn y Pillow; no contiene Torch, Ultralytics, ONNX Runtime, pesos ni fotos.
- La publicación pública sigue bloqueada por la revisión de derechos de pesos/datos, obligaciones AGPL, fuente correspondiente y avisos. El uso académico no crea una exención automática.
