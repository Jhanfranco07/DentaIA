# Railway: estado de evaluación y configuración futura

Esta guía separa la simulación desplegada de una posible evaluación ONNX futura. La revisión no consultó Railway ni aplicó cambios remotos. Los datos de despliegue de la sección siguiente son los antecedentes proporcionados por el equipo, no verificaciones independientes realizadas aquí.

## Simulación reportada como desplegada

Según el contexto proporcionado, el servicio `luminous-communication`, en el proyecto `overflowing-surprise` y entorno `production`, tiene Root Directory `/`, usa `Dockerfile.evaluation` y health check `/health`. El despliegue se habría ejecutado con:

```text
railway up ./services/dental-vision --path-as-root --service luminous-communication --environment production
```

También se reportó `GET /health` con HTTP 200, `mode: simulation` y `model_loaded: false`, y `/predict` sin secreto con HTTP 401. No está comprobado por esta revisión: que `/predict` funcione con una imagen y secreto válidos, que GitHub Auto Deploy esté desactivado, ni la configuración actual de Service Settings. La simulación no ejecuta ONNX ni descarga pesos.

Para conservar este modo de evaluación, configura el servicio desde **Railway → Service Settings**. No dependas de `railway.json`: ese archivo se retiró del repositorio. Mantén GitHub Auto Deploy **desactivado hasta contar con autorización explícita**. No uses fotografías reales de pacientes en la evaluación.

## Configuración futura de ONNX — no aplicada

Esta configuración describe una posible evaluación posterior; no corresponde al servicio de simulación reportado como desplegado y no ha sido aplicada ni validada en Railway. Solo considerarla cuando exista autorización y se resuelvan los bloqueos de `LICENSE_REVIEW.md`.

En **Service Settings**, la configuración prevista sería:

- Root Directory: `/services/dental-vision`.
- Builder: Dockerfile.
- Dockerfile path: `Dockerfile.railway`.
- Health check path: `/health`.
- GitHub Auto Deploy: desactivado hasta autorización explícita.

Variables previstas para ese servicio futuro:

```text
MODEL_BACKEND=onnx
MODEL_PATH=models/best.onnx
MODEL_MANIFEST_PATH=models/best.onnx.json
DENTAL_VISION_SERVICE_SECRET=<secreto ASCII aleatorio de al menos 32 bytes>
```

El Dockerfile ONNX descarga pesos durante el build y los exporta. No ejecutes ese build sin autorización específica para descargar artefactos y dependencias. El uso académico no constituye una exención automática de licencia.

## Conexión futura desde Next.js

Solo tras autorizar y aprobar la integración, configura `DENTAL_VISION_API_URL` en el entorno servidor de Next.js con una URL HTTPS que termine en `/predict`, junto con el mismo `DENTAL_VISION_SERVICE_SECRET`. No uses `NEXT_PUBLIC_` ni envíes el secreto al navegador. La ruta actual de Next.js conserva una allowlist de dos imágenes demo; esta guía no habilita fotografías arbitrarias ni fotos reales de pacientes.

## Verificación y rollback previstos

Antes de cualquier uso futuro del servicio ONNX, valida el contexto Docker, el build Linux, `/health`, autenticación, errores de `/predict`, memoria y latencia. La imagen completa y la inferencia ONNX en Railway aún no están comprobadas por esta revisión. Si una futura evaluación autorizada falla, usa el procedimiento aprobado del proyecto para volver a la versión revisada; no se realizaron acciones de rollback.

## Bloqueo de publicación

La publicación pública y la distribución del servicio/modelo continúan bloqueadas hasta aclarar los derechos de pesos y datos, las obligaciones AGPL, la fuente correspondiente y los avisos/SBOM. No se debe exponer públicamente el servicio ONNX antes de resolver esos puntos.
