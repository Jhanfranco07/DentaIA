# Evaluación simulada en Railway

Esta variante comprueba el contenedor y el contrato HTTP **sin descargar ni cargar pesos**. `/predict` valida la imagen y responde `status: simulation`, `simulated: true`, `model: null` y `predictions: []`. No ejecuta ONNX ni devuelve predicciones o diagnósticos. **No uses fotografías reales de pacientes** en esta evaluación.

## Despliegue y verificaciones reportados

El siguiente estado procede del contexto proporcionado por el equipo; no fue consultado ni comprobado independientemente en Railway durante esta revisión:

- Proyecto: `overflowing-surprise`.
- Servicio: `luminous-communication`.
- Entorno: `production`.
- Root Directory: `/`.
- Dockerfile: `Dockerfile.evaluation`.
- Health check: `/health`.
- Comando reportado como ejecutado:

  ```text
  railway up ./services/dental-vision --path-as-root --service luminous-communication --environment production
  ```

- `GET /health` respondió HTTP 200 con `mode: simulation` y `model_loaded: false`.
- `/predict` sin secreto respondió HTTP 401.

No se ha comprobado `/predict` con imagen y secreto válidos, ni la validación de formatos, límites y respuesta simulada en el servicio remoto. Tampoco se verificó si GitHub Auto Deploy está desactivado. Mantener Auto Deploy **desactivado hasta contar con autorización** y configurar el servicio desde **Railway → Service Settings**; el repositorio ya no depende de `railway.json`. El estado reportado no autoriza un despliegue nuevo ni una publicación pública.

## Configuración local de la variante

En Service Settings, los valores reportados para la simulación son Root Directory `/` y `Dockerfile.evaluation`, junto con health check `/health`. El endpoint requiere `DENTAL_VISION_SERVICE_SECRET` ASCII de al menos 32 bytes para `/predict`. No hace falta `MODEL_BACKEND`: la aplicación no carga modelos. Railway proporciona `PORT` y el contenedor escucha en `0.0.0.0`.

El Dockerfile de evaluación instala FastAPI, Starlette, Pydantic, Uvicorn y Pillow. No copia pesos, fotos ni módulos de inferencia. Para probar localmente desde `services/dental-vision`:

```powershell
docker build -f Dockerfile.evaluation -t dentaia-vision:evaluation .
python -m pip install -r requirements-evaluation-test.txt
python -m pytest -q tests/test_evaluation.py
```

Estos comandos son instrucciones, no resultados de esta revisión. No se construyó la imagen aquí.

## Uso futuro del backend ONNX

La simulación y el servicio ONNX son configuraciones distintas. Una evaluación ONNX futura requiere autorización, revisión de licencias y una configuración manual separada en Service Settings: Root Directory `/services/dental-vision`, builder Dockerfile, Dockerfile path `Dockerfile.railway`, health check `/health`, y variables `MODEL_BACKEND=onnx`, `MODEL_PATH=models/best.onnx`, `MODEL_MANIFEST_PATH=models/best.onnx.json` y `DENTAL_VISION_SERVICE_SECRET`. No ejecutar el build ONNX sin autorización: descarga pesos y dependencias.

La conexión futura desde Next.js debe usar HTTPS y mantener el secreto exclusivamente en el servidor. La ruta de Next conserva su allowlist de dos imágenes demo; esta evaluación no habilita imágenes arbitrarias. No enviar fotografías reales de pacientes.

## Pendientes y restricciones

- Probar `/predict` remoto con imagen sintética válida y secreto, y comprobar errores/formato/límites; no usar fotos de pacientes.
- Confirmar en Service Settings el Root Directory, Dockerfile, health check y estado de GitHub Auto Deploy antes de cualquier nueva acción autorizada.
- No se probó Railway desde esta revisión ni se consultó su configuración actual.
- La publicación pública del backend real sigue bloqueada por derechos de pesos/datos, obligaciones AGPL, fuente correspondiente y avisos/SBOM. El uso académico no es una exención automática.
