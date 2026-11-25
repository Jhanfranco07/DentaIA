# Contrato de visión Premium

## Alcance

Este incremento prepara el límite técnico para un futuro proveedor RF-DETR Premium. No habilita inferencia, no crea rutas, no guarda resultados y no cambia la interfaz. Smile V17 conserva su contrato y comportamiento actuales.

## Componentes reutilizados

| Responsabilidad | Componente o ruta existente | Punto de extensión futuro |
| --- | --- | --- |
| Experiencia de captura, archivo, cámara y vista previa | `src/features/analisis/AnalisisDental.tsx` en `/analisis` | La misma acción de análisis decidirá las capacidades con el plan validado por el servidor. No se creará otra experiencia de captura. |
| Fotografía preparada desde la galería | `src/features/analisis/FotografiaPreparacionContexto.tsx`, montado por `src/app/(paciente)/layout.tsx` | Free y Premium reciben el mismo objeto `File` en memoria. |
| Formato, tamaño y configuración de cámara | `src/features/analisis/fotografia.ts` | MediaPipe podrá observar el `video` y aportar instrucciones de encuadre antes de la captura. No sustituirá `getUserMedia`, el selector de archivo ni esta validación. |
| Galería y consentimiento de almacenamiento | `src/app/(paciente)/fotografias/page.tsx` en `/fotografias` | El consentimiento de almacenamiento seguirá separado del procesamiento temporal y del acceso profesional. |
| Autorización de identidad para visión | `src/features/autorizacion/vision-demo.ts` y `vision-demo-server.ts` | `premium-vision/server.ts` reutiliza esta verificación antes de consultar el plan. |
| Plan efectivo | `src/features/planes/premium-server.ts` y `catalogo.ts` | La capacidad `premium_visual_evaluation` exige una suscripción activa y vigente obtenida por el servidor. Permanece deshabilitada. |
| Smile V17 | `POST /api/desarrollo/dentaia-smile` y `src/features/analisis/smile-contract.ts` | Smile continúa como motor compartido. El proveedor Premium se orquestará como una capacidad adicional sin modificar su contrato. |
| Historial y acceso profesional | `src/features/analisis/smile-history-server.ts` y las tablas ya versionadas | Son referencias para un incremento posterior. Este contrato no concede almacenamiento ni acceso profesional. |

## Límites del módulo

`src/features/premium-vision/contract.ts` define `dentaia.premium-vision-result.v1`. Las seis etiquetas originales son cerradas y conservan `tooth_discolation`. Cada detección mantiene `coco_category_id` e `inference_class_index` como identificadores independientes. El contrato no contiene campos FDI.

El bounding box usa `xyxy`, origen superior izquierdo y píxeles de la imagen de referencia. `x_max` y `y_max` son límites dentro de las dimensiones declaradas. La puntuación `confidence` se valida entre 0 y 1 y representa la salida del detector. No expresa una probabilidad clínica.

Los estados diferencian una evaluación con detecciones, una evaluación sin detecciones, una evaluación parcial, una imagen no evaluable, un proveedor no disponible y un error de procesamiento. Una evaluación `partially_evaluated` puede contener cero o más detecciones válidas, debe conservar limitaciones explícitas y nunca equivale a una evaluación completa. Cero detecciones en una evaluación parcial no implica ausencia de enfermedad.

El contrato también declara calidad, disponibilidad y limitaciones. Todas las respuestas requieren una versión de modelo válida, excepto `provider_unavailable`, que es el único estado que admite `model.version: null`.

`provider.ts` define la interfaz que deberá implementar el adaptador RF-DETR con pesos PyTorch. Reutiliza el tipo MIME permitido por `fotografia.ts`, recibe bytes ya autorizados y valida la respuesta contra el descriptor del proveedor. No conoce sesiones, planes, consentimientos, persistencia ni Smile.

`authorization.ts` compone decisiones verificadas. `server.ts` enlaza la identidad existente con `readEffectivePlan` y exige un verificador específico de consentimiento. La capacidad está registrada con `implemented: false`, por lo que cualquier integración futura falla cerrada hasta una activación explícita.

## Consentimientos

El consentimiento de procesamiento Premium usa el alcance `temporary_premium_evaluation`. Una futura ruta deberá validar una versión explícita del consentimiento antes de leer o reenviar la imagen. Este consentimiento no autoriza almacenamiento. Guardar el original, el overlay o el resultado requiere verificar además un consentimiento de almacenamiento vigente. Compartir con un profesional requiere una concesión independiente y revocable.

## Secuencia futura

1. La pantalla existente obtiene o recibe una fotografía y conserva la vista previa.
2. El servidor verifica identidad, plan efectivo, capacidad activada y consentimiento. Antes de leer el cuerpo, procesar bytes de imagen o invocar cualquier inferencia, la futura ruta debe consumir obligatoriamente el limitador existente mediante `consumeVisionAnalysisRequestLimit(userId)` y detenerse si este rechaza la solicitud.
3. Smile V17 puede producir su resultado compartido actual.
4. Para Premium, el orquestador invoca además un `PremiumVisionProvider` y valida la respuesta con `assertPremiumVisionResult`.
5. Un incremento posterior aplica almacenamiento consentido, historial y acceso profesional.

MediaPipe se incorporará antes del paso 2 como ayuda local de captura. RF-DETR se incorporará en el paso 4. Ninguno requiere duplicar la cámara, la carga, la preparación o la vista previa.

## Pendientes para activar RF-DETR

- Verificar pesos finales, hash, versión, licencia y términos del dataset.
- Verificar el manifiesto COCO para mapear IDs de categoría a índices internos sin inferirlos.
- Registrar métricas reales por clase y evidencia de evaluación. El smoke test o el entrenamiento por sí solos no aportan validación clínica.
- Implementar un adaptador de servidor y sus límites operativos sin ONNX.
- Definir persistencia versionada y probar RLS, revocación y separación entre procesamiento, almacenamiento y acceso profesional en un entorno autorizado.
- Coordinar el punto de orquestación con el responsable de Smile para evitar cambios simultáneos en su ruta y contrato.
