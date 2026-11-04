# DentaIA: microservicio de visión artificial (PoC)

Servicio independiente de Next.js y Supabase. Usa exclusivamente el detector YOLO11m de `Eeman1113/dental_study`; no usa MedGemma, Ollama ni APIs de pago. No se ha publicado ni integrado en la aplicación principal.

## Estado y alcance

Consultar [evaluación técnica](TECHNICAL_REVIEW.md) y los JSON de `evidence/` para resultados medidos y bloqueos. Un smoke test con dos fotografías no valida precisión, seguridad clínica ni generalización. Las clases se devuelven literalmente como `d` y `D`: no se convierten en diagnósticos, gravedad ni recomendaciones.

La API ONNX de menor memoria midió **329 MiB de pico aproximado y 2.01 s de mediana caliente**. Es el candidato preparado para evaluar Render Free. La variante PyTorch midió 724 MiB y no se recomienda para sus 512 MB. Estas mediciones son de Windows: **el funcionamiento en Render Free todavía no está confirmado**; falta comprobar el contenedor Linux, sus límites y el arranque frío.

## Instalación local

Desde `services/dental-vision`, usar Python 3.11.9:

```powershell
python -m venv "$env:USERPROFILE/.venvs/dentaia-vision"
$visionPython = "$env:USERPROFILE/.venvs/dentaia-vision/Scripts/python.exe"
& $visionPython -m pip install --no-compile -r requirements-dev.txt
& $visionPython scripts/download_model.py
$env:DENTAL_VISION_SERVICE_SECRET = (& $visionPython -c "import secrets; print(secrets.token_hex(32))")
& $visionPython -m uvicorn app.main:app --host 127.0.0.1 --port 10000 --workers 1 --limit-concurrency 4 --no-access-log
```

En Windows usar una ruta corta para el entorno: ONNX incluye rutas internas largas y puede fallar con WinError 206 dentro de este directorio. En Linux crear `.venv`, instalar `requirements-dev.txt`, activar `.venv/bin/activate` y usar `python` para los comandos. El secreto es obligatorio, ASCII y de al menos 32 bytes. Se configura en el entorno, nunca se incluye en Git ni en variables `NEXT_PUBLIC_`.

`MODEL_BACKEND=torch` es el valor local por defecto; `MODEL_BACKEND=onnx` selecciona la sesión ONNX de menor memoria. `MODEL_PATH` predeterminado es `models/best.pt` o `models/best.onnx` según el backend. ONNX requiere su manifiesto de exportación `models/best.onnx.json` (o `MODEL_MANIFEST_PATH`), que vincula el artefacto por hash a los pesos originales. Los archivos y el manifiesto deben proceder del build confiable, nunca de una petición. El exportador genera ambos. Un detector se carga una vez por proceso; si falta o falla, el servicio queda degradado. No hay sustitución silenciosa entre backends: corregir y reiniciar.

## Contrato HTTP

- `GET /health`: `200` con `status: "ok"`, `model_available: true`, `device: "cpu"` y `backend: "torch"` o `"onnx"`; `503` si el modelo no está disponible. Sin autenticación para el health check de Render.
- `POST /predict`: cuerpo **binario** de la imagen, `Content-Type: image/jpeg`, `image/png` o `image/webp`; cabecera `X-Service-Secret`. No usa multipart ni base64.
- Respuesta: `model`, dimensiones tras corregir orientación EXIF, `inference_ms`, `detections[]` con `class_id`, `class_name`, `confidence` y `box: {x_min,y_min,x_max,y_max}`. Coordenadas entre 0 y 1 relativas a la imagen orientada, origen superior izquierdo; no son coordenadas de la imagen reducida a 640.
- Una lista vacía significa que no se superó el umbral; no certifica una boca sana. No se fabrican resultados cuando falla el modelo.
- Errores: `401` credenciales, `400` longitud inválida, `413` más de 8 MiB o 12 millones de píxeles, `415` formato o MIME incongruente, `422` imagen inválida/truncada/animada, `429` inferencia ocupada, `503` modelo/inferencia no disponible.

```powershell
curl.exe --fail-with-body http://127.0.0.1:10000/health
curl.exe --fail-with-body http://127.0.0.1:10000/predict -H "X-Service-Secret: $env:DENTAL_VISION_SERVICE_SECRET" -H "Content-Type: image/jpeg" --data-binary '@foto-autorizada.jpg'
```

La API no guarda imágenes, nombres, EXIF, cuerpos ni resultados en disco o BD. Decodifica e infiere en memoria; no usa `UploadFile` ni spool temporal. `Cache-Control: no-store`. Ultralytics puede escribir su configuración de ejecución, que no contiene fotografías. El script de evaluación sí descarga muestras públicas a `evidence/private/` (ignorado); esto está separado del manejo de peticiones. No registrar cuerpos/cabeceras en proxies externos.

## Pruebas y mediciones reproducibles

```powershell
& $visionPython -m pytest -m 'not real' -q
& $visionPython scripts/download_samples.py
& $visionPython scripts/export_onnx.py
$env:RUN_REAL_INFERENCE = '1'
& $visionPython -m pytest -m real -q
$env:MODEL_BACKEND = 'torch'
& $visionPython scripts/benchmark.py
& $visionPython scripts/benchmark_onnx.py
& $visionPython scripts/compare_backends.py
$env:ORT_LOW_MEMORY = '1'
& $visionPython scripts/benchmark_onnx.py
& $visionPython scripts/compare_backends.py --low-memory
$env:MODEL_BACKEND = 'onnx'
& $visionPython scripts/benchmark.py
```

`tests/test_api.py` usa un **mock explícito**, incluidas sus coordenadas ficticias; solo demuestra contrato y controles. `tests/test_real.py` prueba por separado PyTorch y ONNX con pesos y fotografías reales; falla si faltan artefactos. No exige detecciones positivas ni sustituye el modelo por un mock. Se omite por defecto y requiere opt-in. Los benchmarks guardan solo números/detecciones en `evidence/`; no escriben fotos recibidas por HTTP. Cada benchmark se ejecuta en otro proceso para no sumar memoria de ambos runtimes. `benchmark.py` con ONNX comprueba además que PyTorch no se haya importado. Los scripts de comparación verifican las salidas registradas en dos muestras; no prueban equivalencia general ni precisión clínica.

Para ejecutar únicamente ONNX fuera del entorno de evaluación, instalar `requirements-onnx.txt` y obtener `best.onnx` más su manifiesto de una exportación confiable. No instalar `requirements.txt`: incorpora PyTorch. `Dockerfile.onnx` realiza esta separación automáticamente mediante dos etapas; el runtime final no contiene PyTorch ni Ultralytics.

## Preparación de Render (sin despliegue automático)

1. Revisar primero los bloqueos y la memoria en `TECHNICAL_REVIEW.md`. No contratar recursos ni asumir que Free soporta YOLO11m.
2. Cuando se decida publicar esta rama, subir **solo** `feature/vision-artificial-poc`; este trabajo no hizo push. Crear un Web Service nuevo, sin vincularlo a la aplicación principal.
3. Seleccionar esa rama y Root Directory `services/dental-vision`, runtime Docker y Dockerfile `./Dockerfile.onnx`. Desactivar Auto Deploy. El build descarga el objeto inmutable LFS, verifica tamaño/hash y exporta ONNX en una etapa que contiene PyTorch. Copia solo el grafo y su manifiesto al runtime ligero. Una cuota LFS o descarga fallida detiene el build. `./Dockerfile` conserva la variante PyTorch para comparación; no es la opción propuesta para Free.
4. Configurar `DENTAL_VISION_SERVICE_SECRET` como secreto del servicio (generar un valor aleatorio propio, no reutilizar valores de pruebas). `PORT` lo proporciona Render. Docker Build Context Directory `.` relativo al Root Directory; conservar el CMD del Dockerfile. Health Check Path `/health`. Un proceso, CPU, sin discos ni Supabase. Consultar [Docker en Render](https://render.com/docs/docker) y [rutas de monorepo](https://render.com/docs/monorepo-support).
5. Seleccionar exclusivamente Free, sin contratar recursos. El Dockerfile ONNX configura `MODEL_BACKEND=onnx`; `/health` debe confirmarlo. Si el build, el arranque o la inferencia superan los recursos, detenerse y registrar el bloqueo; no pasar a un plan de pago automáticamente.
6. Tras un despliegue futuro, verificar `/health`, peticiones sin secreto, formatos inválidos y fotos autorizadas; medir arranque frío y memoria del contenedor. No hay un despliegue Render ejecutado en esta entrega.

Ambos Dockerfiles incluyen el artefacto del modelo en la imagen, sin descargas durante el arranque o después del reposo. No se pudieron construir aquí porque Docker no está disponible. Render Free tiene sistema de archivos efímero, reposo tras 15 minutos y un arranque frío que debe contemplarse en el timeout del futuro backend. Fuentes: [Free](https://render.com/docs/free), [compute plans](https://render.com/docs/compute-plans).

Antes de desplegar, en un equipo con Docker se puede aproximar el límite del runtime y repetir las peticiones autorizadas. Estos comandos se entregan para validación posterior; no se ejecutaron aquí:

```powershell
docker build -f Dockerfile.onnx -t dentaia-vision-poc .
docker run --rm --memory=512m --cpus=0.1 -p 10000:10000 --env DENTAL_VISION_SERVICE_SECRET dentaia-vision-poc
```

## Integración posterior desde Next.js (solo guía)

El navegador enviará la foto a un Route Handler autenticado de Next.js. Ese handler verificará usuario, consentimiento, límites y frecuencia antes de reenviar los bytes a `/predict`. Solo el backend conocerá `DENTAL_VISION_URL` y `DENTAL_VISION_SERVICE_SECRET`; importar `server-only`. Usar HTTPS, `fetch(..., {method: 'POST', headers: {'Content-Type': mime, 'X-Service-Secret': process.env.DENTAL_VISION_SERVICE_SECRET}, body: bytes, cache: 'no-store', signal: AbortSignal.timeout(60000)})`.

No enviar el secreto al navegador ni aceptar URLs arbitrarias del cliente para el servicio. Manejar `429`, `503` y timeout como indisponibilidad, sin sustituirlos por detecciones. No se han creado handlers, modificado componentes ni cambiado Supabase.

## Procedencia y licencias

Pesos: [repositorio candidato](https://github.com/Eeman1113/dental_study/tree/f02596a0227b9eaf767b955cd67196236111a3d5), commit `f02596a0227b9eaf767b955cd67196236111a3d5`. SHA-256 `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`, 80 923 921 bytes. Nunca se cargan pesos de usuario; un checkpoint PyTorch contiene objetos serializados y solo debe cargarse desde la procedencia fijada y verificada. Un hash verifica integridad frente al puntero, no una auditoría de seguridad del autor.

El README candidato declara código MIT y pesos YOLO AGPL-3.0; no incluye un archivo LICENSE en el árbol inspeccionado. No se copió su pipeline. El checkpoint declara AGPL-3.0. [Ultralytics](https://www.ultralytics.com/license) exige atender las condiciones AGPL para código y modelos, también al exportar a ONNX; el desacoplamiento por HTTP no resuelve por sí solo el alcance de licencia de una futura integración. No se ha relicenciado DentaIA. Resolver cumplimiento antes de publicar; una licencia comercial no forma parte de esta PoC gratuita.

Datos/muestras: Ahmed, S. M. F.; Ghori, H.; Khalid, A.; Nooruddin, A.; Adnan, N.; Lal, A.; Umer, F. (2025), Aga Khan University. *Annotated intraoral image dataset for dental caries detection*, [DOI 10.5281/zenodo.14827784](https://doi.org/10.5281/zenodo.14827784), CC BY 4.0 según [metadatos originales](https://zenodo.org/api/records/14827784). Las muestras sin modificar proceden del split test oclusal del candidato, que atribuye el conjunto a Zenodo; no se ha auditado consentimiento individual ni la correspondencia binaria con el ZIP original completo. `evidence/samples.json` conserva atribución, URLs y hashes. La licencia pública permite su evaluación técnica con atribución; no equivale a una autorización para datos privados de pacientes.
