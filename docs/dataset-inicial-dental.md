# Dataset inicial para entrenamiento exploratorio — DI-38 (S06)

**Estado:** borrador para revisión del equipo
**Historia:** [DI-38 — Explorar datasets y protocolo de anotación dental](https://jhanfranco.atlassian.net/browse/DI-38)

---

## 1. Propósito y alcance

Este documento registra el **dataset inicial** que se propone usar como punto de partida para el entrenamiento y la evaluación de un modelo de detección **en una fase exploratoria futura**.

- La demo actual de DentAI **no utiliza IA** y no depende de este dataset para funcionar.
- El modelo, cuando exista, **no constituye un diagnóstico odontológico** ni cuenta con validación clínica.
- En este PR **no se entrenó ningún modelo ni se reportan métricas**. Todo lo que aparece como propuesta es una **hipótesis de trabajo** y se identifica como tal.

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