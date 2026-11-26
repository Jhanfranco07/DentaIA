# Contrato de visión Premium

## Alcance

El contrato v1 se reutiliza en la integración local de RF-DETR Small Premium v1.0.0. El servicio FastAPI y la opción temporal en `/analisis` permanecen deshabilitados por defecto; no se han desplegado ni activado en producción. Esta integración no guarda resultados Premium ni habilita la ingesta HMAC de DI-214. Smile V17 conserva su contrato y comportamiento actuales.

## Componentes reutilizados

| Responsabilidad | Componente o ruta existente | Punto de extensión futuro |
| --- | --- | --- |
| Experiencia de captura, archivo, cámara y vista previa | `src/features/analisis/AnalisisDental.tsx` en `/analisis` | La misma acción de análisis decidirá las capacidades con el plan validado por el servidor. No se creará otra experiencia de captura. |
| Fotografía preparada desde la galería | `src/features/analisis/FotografiaPreparacionContexto.tsx`, montado por `src/app/(paciente)/layout.tsx` | Free y Premium reciben el mismo objeto `File` en memoria. |
| Formato, tamaño y configuración de cámara | `src/features/analisis/fotografia.ts` | MediaPipe podrá observar el `video` y aportar instrucciones de encuadre antes de la captura. No sustituirá `getUserMedia`, el selector de archivo ni esta validación. |
| Galería y consentimiento de almacenamiento | `src/app/(paciente)/fotografias/page.tsx` en `/fotografias` | El consentimiento de almacenamiento seguirá separado del procesamiento temporal y del acceso profesional. |
| Autorización de identidad para visión | `src/features/autorizacion/vision-demo.ts` y `vision-demo-server.ts` | `premium-vision/server.ts` reutiliza esta verificación antes de consultar el plan. |
| Plan efectivo | `src/features/planes/premium-server.ts` y `catalogo.ts` | La capacidad `premium_visual_evaluation` exige una suscripción activa y vigente obtenida por el servidor; `runtime.ts` exige flags explícitos para invocar el servicio. |
| Smile V17 | `POST /api/desarrollo/dentaia-smile` y `src/features/analisis/smile-contract.ts` | Smile continúa como motor compartido. La respuesta Premium opcional es independiente y un fallo del proveedor no se convierte en cero detecciones. |
| Historial y acceso profesional | `src/features/premium-vision/history-server.ts` y los recursos de DI-214 | El resultado temporal aún no se conecta a la ingesta consentida ni a las concesiones profesionales. |

## Límites del módulo

`src/features/premium-vision/contract.ts` define `dentaia.premium-vision-result.v1`. Las seis etiquetas originales son cerradas y conservan `tooth_discolation`. Cada detección mantiene `coco_category_id` e `inference_class_index` como identificadores independientes. El contrato no contiene campos FDI.

El bounding box usa `xyxy`, origen superior izquierdo y píxeles de la imagen de referencia. `x_max` y `y_max` son límites dentro de las dimensiones declaradas. La puntuación `confidence` se valida entre 0 y 1 y representa la salida del detector. No expresa una probabilidad clínica.

Los estados diferencian una evaluación con detecciones, una evaluación sin detecciones, una evaluación parcial, una imagen no evaluable, un proveedor no disponible y un error de procesamiento. Una evaluación `partially_evaluated` puede contener cero o más detecciones válidas, debe conservar limitaciones explícitas y nunca equivale a una evaluación completa. Cero detecciones en una evaluación parcial no implica ausencia de enfermedad.

El contrato también declara calidad, disponibilidad y limitaciones. Todas las respuestas requieren una versión de modelo válida, excepto `provider_unavailable`, que es el único estado que admite `model.version: null`.

`provider.ts` define la interfaz del adaptador RF-DETR con pesos PyTorch. `http-provider.ts` la implementa frente al servicio independiente. Reutiliza el tipo MIME permitido por `fotografia.ts`, recibe bytes ya autorizados y valida la respuesta contra el descriptor del proveedor. No conoce sesiones, planes, consentimientos, persistencia ni Smile.

`authorization.ts` compone decisiones verificadas. `server.ts` enlaza la identidad existente con `readEffectivePlan` y exige un verificador específico de consentimiento. La capacidad está registrada para Premium, pero `runtime.ts` la mantiene deshabilitada por defecto y exige un segundo flag en producción.

## Consentimientos

El consentimiento de procesamiento Premium usa el alcance `temporary_premium_evaluation`. La ruta valida la versión `premium-vision-processing-v1` antes de leer o reenviar la imagen. Este consentimiento no autoriza almacenamiento. Guardar el original, el overlay o el resultado requiere verificar además un consentimiento de almacenamiento vigente. Compartir con un profesional requiere una concesión independiente y revocable.

`history-server.ts` conserva el punto de escritura de DI-214 sin ruta HTTP de ingesta. `history-ingest-runtime.ts` exige un flag de ingesta separado, una clave HMAC válida y un segundo flag en producción; todos permanecen sin configurar. La escritura usa el JWT del paciente y `access_premium_history`, donde RLS, consentimiento de resultados y fotografía, y revocación se verifican de nuevo. La lectura y revocación del historial previo no dependen de estos flags. El historial solo anuncia nuevas evaluaciones cuando tanto la inferencia como la ingesta están habilitadas y el plan sigue vigente.

## Secuencia implementada localmente

1. La pantalla existente obtiene o recibe una fotografía y conserva la vista previa.
2. El servidor verifica identidad, plan efectivo, capacidad activada y consentimiento. Antes de leer el cuerpo, procesar bytes de imagen o invocar cualquier inferencia, la ruta consume el limitador existente mediante `consumeVisionAnalysisRequestLimit(userId)` y se detiene si este rechaza la solicitud.
3. Smile V17 puede producir su resultado compartido actual.
4. Para Premium, el orquestador invoca además un `PremiumVisionProvider` y valida la respuesta con `assertPremiumVisionResult`.
5. Un incremento posterior conecta el almacenamiento consentido, el historial y el acceso profesional de DI-214.

MediaPipe sigue como ayuda local de captura antes del paso 2. RF-DETR se invoca opcionalmente en el paso 4. Ninguno duplica la cámara, la carga, la preparación o la vista previa.

## Pendientes para activar RF-DETR

- Resolver los tres hallazgos OpenSSL altos de la imagen antes de aprobar su publicación o documentar una decisión de riesgo específica para ese alcance. La aceptación existente cubre solo el smoke local offline.
- Obtener una referencia verificable del evaluador original de Colab para certificar paridad numérica. El notebook original (SHA-256 `12b7bd19d318d59cdc417ec5bc129233d899e49e4a07618b284d0ef6ccfb85d4`) muestra extracción a 0.0 y filtro operativo `>= 0.35`, pero aún no incluye una fixture permitida con predicciones de esa misma entrada antes y después del filtro. El smoke sintético no aporta validación clínica.
- Conectar la salida temporal con la ingesta consentida de DI-214, la clave HMAC y la autorización profesional solo después de la activación aprobada; probar RLS y revocación en un entorno autorizado.
