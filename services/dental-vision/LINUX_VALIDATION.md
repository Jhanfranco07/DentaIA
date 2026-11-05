# Evaluación Linux y configuración Render

No desplegar todavía. Solo se publica código preparatorio revisado, sin pesos ni fotografías. Ejecutar desde `services/dental-vision`, con Docker configurado para contenedores Linux. Python 3.11.9 está fijado en la imagen; la instalación del host solo necesita Python estándar y Docker CLI para orquestar. Estado de la pausa: exportación Linux verificada y 21 pruebas Linux aprobadas; validación integral y medición de 512 MiB pendientes.

## Flujo reproducible

```powershell
python scripts/linux_validation.py
```

El script construye localmente `dentaia-vision-poc:onnx-linux` y ejecuta las 21 pruebas originales dentro de la etapa Docker `test-execution`, con `RUN --network=none`. Exporta únicamente su JUnit mediante `test-receipt`, sin empaquetar otra imagen pesada de pruebas. `--no-cache-filter test-execution` fuerza una nueva ejecución de la suite conservando la caché de dependencias. La suite carga PyTorch y ONNX sin límite de 512 MiB y no se usa para medir producción.

Luego arranca **la imagen de producción**, sin Torch ni Ultralytics, con límite de 512 MiB, sin swap, cuota de 0.1 CPU y un único worker. El secreto aleatorio se transmite por entorno al contenedor, sin imprimirse ni introducirse en Git/argumentos con su valor. El puerto se publica únicamente en loopback y el sistema de archivos es de solo lectura (tmpfs de 16 MiB para archivos temporales del runtime). Se eliminan exclusivamente los contenedores con nombre único creados por esa ejecución; no se hace prune ni se borran imágenes ajenas.

El script comprueba `/health`, rechazos `401/415/422`, ocho peticiones reales con las dos fotos públicas autorizadas y ausencia del secreto/contenido de error en logs. No exige detecciones positivas. Las fotos de evaluación solo están en la imagen de tests o en la carpeta ignorada `evidence/private`, nunca en la imagen de producción. No se escriben imágenes recibidas por HTTP.

Salidas: `evidence/linux/validation.json` y `evidence/linux/tests-linux.xml`. La memoria máxima del proceso se obtiene del máximo del kernel `/proc/1/status: VmHWM`; `memory.peak` del cgroup incluye caché de archivos y las pequeñas sondas estándar. Se informan ambas, además de OOM, tiempo de carga del modelo, tiempo hasta disponibilidad, primera latencia y mediana caliente. No confundir RSS con consumo total del contenedor. Si hay error u OOM, el resultado no se marca compatible.

Las respuestas de `/health` incluyen `model_load_seconds`; es el tiempo de resolución/importación/carga del detector, no el tiempo total desde `docker run`. Las métricas de este entorno no garantizan la misma latencia en la infraestructura Render.

Si hay OOM o el consumo alcanza el límite, no declarar compatibilidad ni aumentar a un plan de pago. Las alternativas de evaluación son reducir el límite de píxeles y repetir las pruebas, o preparar una exportación INT8 con calibración y validación independientes de precisión/paridad. Reducir resolución de inferencia o cambiar de detector requiere una nueva evaluación; no se presentan como soluciones ya verificadas.

## Comandos Docker equivalentes

```powershell
docker build --target runtime -f Dockerfile.onnx -t dentaia-vision-poc:onnx-linux .
docker build --target test-receipt --no-cache-filter test-execution --output type=local,dest=evidence/linux -f Dockerfile.onnx .
$env:DENTAL_VISION_SERVICE_SECRET = (python -c "import secrets; print(secrets.token_hex(32))")
docker run --rm --memory=512m --memory-swap=512m --cpus=0.1 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop=ALL --security-opt no-new-privileges -p 127.0.0.1:10000:10000 --env DENTAL_VISION_SERVICE_SECRET dentaia-vision-poc:onnx-linux
```

No ejecutar la suite Torch dentro del contenedor de 512 MiB. Para recoger automáticamente métricas y recibos, usar el script completo.

## HTTP manual

En otro terminal, con el mismo secreto en su entorno y una foto pública autorizada:

```powershell
curl.exe --fail-with-body http://127.0.0.1:10000/health
curl.exe -i -X POST http://127.0.0.1:10000/predict -H 'Content-Type: image/jpeg' --data-binary '@foto-autorizada.jpg'
curl.exe --fail-with-body http://127.0.0.1:10000/predict -H "X-Service-Secret: $env:DENTAL_VISION_SERVICE_SECRET" -H 'Content-Type: image/jpeg' --data-binary '@foto-autorizada.jpg'
```

Esperado: salud 200 con `backend: onnx`, `model_available: true`; petición sin secreto 401; petición válida 200 con clase, confianza y cajas normalizadas. Una lista vacía es válida y no demuestra salud dental. Imagen inválida debe devolver 422 sin reflejar datos enviados. No habilitar access logs ni registrar cabeceras/cuerpos en el futuro backend/proxy.

## Configuración exacta Render, pendiente de aprobación técnica y licencia

| Campo | Valor |
| --- | --- |
| Tipo / plan | Web Service, Docker, Free; no crear todavía |
| Rama | `feature/vision-artificial-poc` |
| Root Directory | `services/dental-vision` |
| Dockerfile Path | `./Dockerfile.onnx` |
| Docker Build Context | `.` |
| Build Command | No aplica en runtime Docker; el equivalente local es `docker build --target runtime -f Dockerfile.onnx -t dentaia-vision-poc:onnx-linux .` |
| Start Command / Docker Command | Dejar vacío para usar el CMD indicado abajo |
| Auto Deploy | Desactivado (`autoDeployTrigger: off`) |
| Health Check Path | `/health` |
| `MODEL_BACKEND` | `onnx` |
| `MODEL_PATH` | `models/best.onnx` |
| `MODEL_MANIFEST_PATH` | `models/best.onnx.json` |
| `DENTAL_VISION_SERVICE_SECRET` | Secreto aleatorio ASCII de al menos 32 bytes; sin valor en Git ni `NEXT_PUBLIC_` |
| `PORT` | Lo asigna Render; 10000 por defecto en Docker local |

CMD efectivo:

```sh
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --limit-concurrency 4 --timeout-keep-alive 5 --no-access-log
```

El build descarga un objeto inmutable `best.pt`, verifica tamaño/SHA-256 y exporta el grafo con pesos embebidos. Verifica con ONNX checker, conserva su licencia y copia únicamente grafo/manifiesto al runtime. No hay descarga ni exportación durante startup/inferencia. El archivo de pesos original no forma parte del runtime. No usar `pip install -r requirements.txt` como Build Command de esta variante Docker.

La plantilla `render.evaluation.yaml.example` solo describe estos campos y no se ha aplicado. Render Free es un endpoint de Internet, no una red privada; revisar [licencia y evaluación privada](LICENSE_REVIEW.md) antes de habilitarlo. El despliegue privado preparado es Docker local con enlace loopback y secreto, sin publicación de imágenes en registries. No se propone contratar un Private Service de pago.
