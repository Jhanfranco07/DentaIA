# Dataset inicial para entrenamiento exploratorio — DI-38 (S06)

**Estado:** documento histórico de investigación exploratoria (04/11/2026); no es el inventario actual del modelo de visión artificial.
**Historia:** [DI-38 — Explorar datasets y protocolo de anotación dental](https://jhanfranco.atlassian.net/browse/DI-38)

---

## 1. Propósito y alcance

Este documento conserva la **propuesta inicial** de dataset para entrenamiento y evaluación exploratoria, formulada el 04/11/2026. Se incluye como evidencia académica de la investigación de DI-38, no como afirmación sobre el dataset efectivamente utilizado o el estado actual de la implementación.

- **Contexto al redactarse (04/11/2026):** la demo de ese momento no utilizaba IA. Posteriormente se inició una prueba de concepto de visión artificial en una rama independiente; esta ficha no acredita su integración o despliegue.
- La implementación experimental de visión artificial no constituye un diagnóstico odontológico y no cuenta aquí con validación clínica.
- En este documento **no se entrenó ningún modelo ni se reportan métricas**. Las propuestas se mantienen como hipótesis históricas, sin afirmar que se hayan ejecutado.

## 2. Ficha del dataset

| Campo | Detalle |
|---|---|
| Nombre | Oral Disease Detection Dataset (YOLOv8/YOLOv11) |
| Enlace | https://www.kaggle.com/datasets/faizan729/dental-cancer-and-abnormality-dataset |
| Plataforma | Kaggle |
| Licencia declarada | Apache 2.0 |
| Formato | YOLOv8 (imágenes + etiquetas `.txt`) |
| Cantidad de imágenes | 23,552 *(según la descripción del autor)* |
| Resolución | 640×640 (preprocesadas) |
| Clases | Calculus, Caries, Gingivitis, Hypodontia, Tooth Discoloration, Ulcer |
| Aumentación declarada | Volteos, rotaciones (−15° a +15°), shear, brillo y ruido sal y pimienta |
| Fecha de consulta | 04/11/2026 |

> Las cifras y características de esta tabla son **declaradas por el autor del dataset** en su página de Kaggle. No se han verificado de forma independiente.

## 3. Origen, licencia y permisos de uso

- **Documentado:** enlace, plataforma y licencia declarada (Apache 2.0).
- **Uso previsto:** exploratorio y académico, dentro del proyecto DentAI.
- **Por verificar en la revisión:** la página no detalla de dónde provienen las imágenes originales ni bajo qué permisos se recopilaron. Se registra como **pendiente de confirmación** y se revisará en las pestañas de discusión y archivos del dataset, y con el autor si es posible.

## 4. Estado de esta evidencia al integrarla

Se integra este documento como **antecedente de investigación** de la historia DI-38, no como especificación técnica vigente de DentaIA. La selección final de datasets, el origen y permiso de las imágenes, la licencia efectiva de pesos/modelo, las métricas reproducibles, la validación clínica y la integración de la IA requieren verificaciones separadas. No sustituye la documentación de la prueba de concepto implementada posteriormente.
