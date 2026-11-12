# Evaluación técnica y registro de validación

Fecha de inspección: 4 de noviembre de 2026 (America/Lima).

## Aislamiento de Git

El directorio original estaba en `docs/auditoria-arquitectura-integral`, HEAD `e9fd2f3`, con dos modificaciones sin confirmar. Se conservaron, sin stash, reset, checkout ni limpieza:

| Archivo original | SHA-256 antes de trabajar |
| --- | --- |
| `docs/arquitectura/GUIA_FINAL_EQUIPO_DENTAIA.md` | `44da5a118b68236cd1e48364e2fb6359a5c0c2840d9791576de4d0fb5a8d439a` |
| `docs/arquitectura/MANIFEST_SHA256.json` | `671b25f6f4679b740ce281c25b867e7eab9405fb368e56ba739fb73dd4e3e9f9` |

Tras verificar que `feature/vision-artificial-poc` no existía localmente (`show-ref`) ni en `origin` (`ls-remote --heads`), se creó con `git worktree add -b feature/vision-artificial-poc ../DentaIA-vision-poc main`. Esto añade un directorio independiente y conserva el árbol de trabajo original. Todos los archivos de la PoC están exclusivamente en `services/dental-vision/` del nuevo worktree.

Referencias protegidas al inicio: `main=6dfe23e1d2070612d296f9323538cfd6e3ad8b79`, `integration/sprint5-demo=ee37c0e253daa7deb32c7983b7cc2dbaf6df91ed`. No hubo merges, push, cambios de módulos Next.js, consultas/escrituras a Supabase ni Jira, migraciones o despliegues.

## Inspección previa a programar

DentaIA es una aplicación Next.js 15/React 19 con módulos separados de cuenta, directorio, solicitudes y fotografías. No existía un servicio Python de inferencia en la base inspeccionada. El microservicio se preparó sin importar módulos de esos integrantes ni depender de su almacenamiento.

El resumen técnico se presentó en el chat antes de implementar el código. Se verificó el candidato [Eeman1113/dental_study](https://github.com/Eeman1113/dental_study/tree/f02596a0227b9eaf767b955cd67196236111a3d5), commit fijado `f02596a0227b9eaf767b955cd67196236111a3d5`:

- `best.pt` en Git es un puntero LFS de 133 bytes, no los pesos. El objeto real de media.githubusercontent.com tiene 80 923 921 bytes y SHA-256 `7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d`, coincidente con el puntero.
- Inspección del archivo ZIP de PyTorch y sus cadenas pickle sin deserializar: referencias a `yolo11m.yaml`, `yolo11m.pt`, versión Ultralytics `8.4.104` y licencia `AGPL-3.0`. La integridad se comprueba de nuevo antes de cargarlo. No confundir la comprobación de hash con una auditoría completa del checkpoint.
- `yolo_split/data.yaml` define dos clases: `0: d`, `1: D`. Se conserva la distinción de mayúsculas. No se inventa una traducción clínica.
- El README declara split por paciente de vistas `Mandibular` y `Maxillary_Occlusal`, con datos de Zenodo. `train_yolo.py` tiene por defecto YOLO11s a 896, pero el checkpoint referencia YOLO11m y `train_args.imgsz=1280`: el script por defecto no describe este entrenamiento. Se registra la reducción de 1280 a 640 como una decisión de recursos, que puede perder sensibilidad a lesiones pequeñas. No se atribuyen a 640 las métricas publicadas por el autor.
- El autor publica mAP50=0.860 y mAP50-95=0.692. Son cifras ajenas, no reproducidas por esta PoC. El script `prepare_data.py` usa una heurística de agrupación que necesita configuración; la afirmación de ausencia de fuga por paciente requiere auditoría adicional del split.
- La fuente original declara 6 313 imágenes (no las aproximadamente 2 000 que menciona el README candidato): [Zenodo](https://zenodo.org/records/14827784). Su API confirma `cc-by-4.0`. Dos muestras de un mismo caso del test sirven para un smoke test técnico; no forman una evaluación representativa ni independiente del modelo.

## Decisiones implementadas

FastAPI con lifespan carga un detector una vez por proceso; CPU, un hilo de PyTorch o una sesión ONNX con un hilo intra/inter-op, un worker de Uvicorn. El procesamiento se ejecuta en un thread para mantener `/health` disponible. Un lock limita a una imagen en curso y devuelve `429` a la siguiente; evita acumular imágenes decodificadas. El límite de bytes también se comprueba durante el streaming sin confiar en Content-Length.

El contrato recibe bytes de JPG/PNG/WebP, verifica formato real, decodificación, dimensiones, animación y EXIF. No emplea multipart que pueda volcar cargas a disco. Predicciones reales con confianza mínima 0.25, IoU de NMS 0.45, hasta 100 detecciones y coordenadas `xyxy` normalizadas. No guarda fotografías ni escribe en Supabase. Un error de modelo devuelve `503`.

Secreto `DENTAL_VISION_SERVICE_SECRET`, comparación constante y validación antes de leer el cuerpo. No hay secreto compartido por defecto ni `NEXT_PUBLIC_`. La protección por secreto autentica al futuro backend; este deberá autenticar al usuario y controlar cuota/consentimiento antes de reenviar imágenes.

## Licencias y límites de publicación

El README candidato declara código MIT, pero GitHub informa `license: null` y no hay archivo LICENSE en el árbol inspeccionado. No se reutilizó su pipeline. El propio checkpoint declara AGPL-3.0; [Ultralytics](https://www.ultralytics.com/license) publica las condiciones para software y pesos entrenados. Exportar a ONNX no elimina estas condiciones. No se cambió la licencia de la aplicación principal: revisar el alcance y cumplir con la publicación de fuentes correspondiente antes de exponer un servicio o integrarlo. No se propone pagar una licencia comercial.

Las imágenes públicas se atribuyen en `evidence/samples.json` conforme a CC BY 4.0. La procedencia desde el split del candidato se basa en su atribución a Zenodo; no se cotejó el ZIP completo ni el consentimiento individual. No utilizar fotos privadas sin autorización. Este servicio es una PoC de detección, no una validación de uso clínico.

## Recursos y despliegue

[Render Free](https://render.com/docs/compute-plans) especifica 512 MB y 0.1 CPU. [Limitaciones](https://render.com/docs/free): reposo a los 15 minutos, arranque frío y disco efímero. El tamaño de 81 MB de los pesos no representa la memoria necesaria para importaciones, parámetros, buffers y activaciones.

Medición real en Windows 10.0.26200, Python 3.11.9, Intel Core i5-14400, CPU, entrada 640, conf=0.25, IoU=0.45. Dos fotografías oclusales de test, cuatro repeticiones por foto. La mediana caliente utiliza repeticiones 1–3 de cada foto (seis peticiones). RSS del proceso muestreada cada 10 ms; aproximación, sin aislar un cgroup de 512 MB. Las latencias de TestClient excluyen red y proxy.

| Variante | Mediana caliente | Pico RSS aproximado | Evidencia |
| --- | ---: | ---: | --- |
| API PyTorch | 844 ms | 724.3 MiB | `evidence/benchmark-torch.json` |
| ONNX aislado, reservas por defecto | 1875 ms | 565.2 MiB | `evidence/benchmark-onnx.json` |
| ONNX aislado, reservas desactivadas | 1944 ms | 345.3 MiB | `evidence/benchmark-onnx-lowmem.json` |
| API ONNX, reservas desactivadas | 2010 ms | 329.4 MiB | `evidence/benchmark-onnx-api.json` |

La primera carga PyTorch tardó 223.72 s y la primera petición 246.88 s, con creación inicial de cachés e importaciones en este Windows. No se ocultaron en un promedio caliente. ONNX API cargó en 4.13 s. Las diferencias entre RSS aislada y API pueden reflejar asignadores y momento de muestreo; no son una garantía de máximos para todas las imágenes autorizadas de hasta 12 millones de píxeles.

Las ocho peticiones reales PyTorch devolvieron consistentemente una detección `d` (confianza aproximada 0.434) en la vista mandibular y cero en la maxilar. No se afirma que esas decisiones sean clínicamente correctas. El checkpoint ejecutado tiene 20 031 574 parámetros fusionados y salida `(1,6,8400)`.

Exportación FP32 ONNX opset 17 real: 80 380 309 bytes, SHA-256 `3e3c9708316d4415e276fd7ba5585476f5fc0f800a25ad3c50b38fcd20ee0434`. Se conservaron ambos nombres de clase y se implementaron letterbox OpenCV y NMS NumPy por clase. En las dos muestras, la comparación registró el mismo número/orden de clases: máximo error absoluto de confianza `2.09e-7` y coordenadas normalizadas `3.73e-8`, por debajo de `1e-4`. Evidencia: `backend-comparison.json` y `backend-comparison-lowmem.json`. Esto verifica esas muestras, no equivalencia general.

El backend ONNX de la API usa `enable_cpu_mem_arena=False` y `enable_mem_pattern=False`, mantiene una sesión por proceso y verifica tamaño/hash del grafo contra el manifiesto de exportación. El benchmark confirmó `torch_imported=false`. `Dockerfile.onnx` separa la exportación con PyTorch del runtime sin PyTorch/Ultralytics; no se modifica el modelo ni se cuantiza para obtener ese ahorro.

**Veredicto Render Free:** PyTorch y ONNX con reservas por defecto superan los 512 MB en estas mediciones y no se proponen para Free. La API ONNX de menor memoria es un candidato plausible por su pico local de 329.4 MiB; queda preparada para probarla en Free. **No está confirmado su funcionamiento en Render**: faltan construir/verificar la imagen Linux y medir límites, arranque frío y latencia con 0.1 CPU. No extrapolar 2.01 s locales a esa CPU. Docker no está disponible aquí y no se realizó ningún despliegue ni contratación. También queda pendiente resolver el cumplimiento AGPL antes de publicar o integrar el servicio.

La instalación inicial de ONNX encontró WinError 206 por la longitud de rutas; se completó usando una ruta corta al mismo entorno (`C:/Users/PC/dentaia-vision-runtime`, junction al `.venv` del servicio). La guía recomienda crear directamente un entorno de ruta corta. `pip check` no encontró dependencias rotas. Los informes JUnit distinguen los tests con mocks de los tests reales, que requieren opt-in explícito y ambos artefactos.

## Resultado de pruebas

Suite final ejecutada con `RUN_REAL_INFERENCE=1`: **21 passed**, 19 pruebas con mocks/unidades de validación y 2 integraciones reales (PyTorch y ONNX, dos fotos cada una). Informe `evidence/tests-all.xml`. El informe independiente `tests-mock.xml` contiene 19 pruebas y excluye las reales. La única advertencia de la suite es la deprecación de HTTPX en Starlette TestClient; no es un fallo ni una detección. Los benchmarks de memoria se ejecutaron en procesos separados de esta suite para no sumar ambos modelos.

La sintaxis Python y la comprobación de espacios de Git pasaron. No se ejecutó build de Next.js porque no se cambió esa aplicación. Los Dockerfiles no se ejecutaron: su validación Linux/Render sigue pendiente, junto con el cumplimiento de licencia para publicación. Las fotografías y los pesos permanecen excluidos de Git; la descarga de ambos se puede reproducir con los scripts y hashes incluidos.

## Continuación desde 363d5e6 y pausa para traslado

Los apartados anteriores conservan la evidencia histórica inicial. En la continuación se inició Docker Linux y se construyó `Dockerfile.onnx`, con producción headless sin PyTorch/Ultralytics y exportación separada mediante la variante oficial headless 8.4.104. La descarga original, el ONNX checker, la ausencia de pesos externos, el metadato AGPL y la carga de una sesión CPU fueron verificados. Hash ONNX Linux: `2c9f66d4b7547dcab625539ceb7ad8870fb93e4171c4863e4c4a29a0cbace4d50`, tamaño 80 380 309 bytes.

Se ejecutaron las **21 pruebas Linux**, con cero errores, fallos u omisiones, en Docker BuildKit sin red durante las pruebas. El JUnit (`evidence/linux/tests-linux.xml`) registra 24.70 s de ejecución. La suite se completó justo antes de que se atendiera la petición de detener las validaciones largas.

**La validación Linux completa del runtime con 512 MiB/0.1 CPU sigue pendiente.** No se obtuvo una medición de memoria máxima ni latencia bajo esos límites; `evidence/linux/validation.json` conserva `KeyboardInterrupt` y no certifica compatibilidad. No se iniciarán más construcciones en esta sesión. La exportación y las pruebas de integración no equivalen a completar esa medición.

Se redujo una copia RGB innecesaria, ONNX pasó a ser el backend predeterminado y `/health` añade tiempo de carga. Se prepararon scripts reproducibles, plantilla Render inactiva y avisos/licencia; la aprobación para publicar el servicio/modelos permanece pendiente. Se autoriza únicamente preservar y subir la rama con código revisado, sin pesos, fotos ni imágenes Docker. Consultar `HANDOFF.md` para continuar desde la laptop.
