# DI-211 · Política temporal Railway QA (pendiente de aprobación específica)

Jhan autorizó preparar una aceptación temporal **exclusiva para QA aislado**. Todavía no aprobó el listado individual ni autorizó desplegar. Esta política no altera el gate `deploy` de producción ni convierte HIGH sin parche en advertencias de revisión general.

## Evidencia de imagen y alcance

Trivy 0.76.2 escaneó la imagen QA local completa con `os,library`, todas las severidades, sin `ignore-unfixed` ni exclusiones. JSON original fuera de Git: `%TEMP%\di211-rfdetr-qa-candidate-trivy.json`, SHA-256 `30533e3262c67bf3651cc35c5313b8c851d1818b71976982143bf3958e8bed0e`. Imagen escaneada: `sha256:56d8cbd3fa6cfb15d27779e77aba5de6d619d4e3a487d324889334d20ce63bbf`. El registro [DI211_RAILWAY_QA_EXCEPTIONS.json](DI211_RAILWAY_QA_EXCEPTIONS.json) enumera **222 tuplas** `(CVE, clase, paquete, versión, severidad)` correspondientes a **99 CVE únicos**, incluidos **53 HIGH** y los tres OpenSSL previamente identificados en sus tres paquetes. No hay CRITICAL ni `FixedVersion` en esta instantánea después de actualizar `libzstd1`, `login.defs`, `passwd` y retirar `pip` del runtime. Cada entrada conserva título, justificación, aplicabilidad no probada, exposición propuesta y controles compensatorios. El JSON completo de Trivy permanece separado y sin filtros.

El SHA-256 canónico de `exceptions` (JSON con claves ordenadas y separadores compactos) es `345f699af8960faef168339ed45baab597432ff40d91b012454c59654b5281d8`. **Estado: pendiente de revisión específica por Jhan.** Si cambia la imagen, paquete, versión, CVE, severidad o cualquier texto del listado, la aprobación anterior deja de coincidir.

## Tres modos dentro del pipeline maestro

| Modo | Cuándo | Regla |
| --- | --- | --- |
| `review` | PR ordinario a `main`/`develop`, y PR no QA hacia Premium | Solo los tres CVE OpenSSL ya documentados tienen excepción de revisión acotada; los demás HIGH/CRITICAL bloquean. No autoriza deploy. |
| `qa` | Solo PR desde `feat/di-211-railway-qa` del mismo repositorio hacia `feat/di-211-rfdetr-premium` | Requiere aprobación externa específica de Jhan, ImageID exacto, hash de las 222 entradas, hora efectiva y vencimiento ≤14 días. Bloquea cualquier hallazgo nuevo o desaparecido respecto del registro, CRITICAL, `FixedVersion`, cobertura incompleta, imagen distinta, aprobación ausente/futura/vencida. El reporte Trivy se adjunta siempre. No publica imagen. |
| `deploy` | Push a `main`/`develop` o `workflow_dispatch` | Política estricta anterior, sin modificación: HIGH/CRITICAL y OpenSSL vulnerable bloquean. QA nunca se selecciona en este evento. |

La única variable de aprobación es **metadata no secreta** en GitHub Repository Variables: `DI211_QA_APPROVAL_JSON`. Jhan debe establecerla **después** de revisar el JSON, el PR, el ImageID real del artefacto CI (impreso en los logs del job `Imagen RF-DETR`) y la lista individual. El `image_id` vive exclusivamente en esta variable — el archivo de política es CI-agnóstico. Forma exacta, sin valores ficticios preconfigurados:

```json
{"approved_by":"Jhanfranco07","image_id":"sha256:<ImageID de Trivy CI aprobado>","exceptions_sha256":"<SHA-256 canónico de exceptions del PR aprobado>","approved_at":"<UTC ISO-8601 de aprobación efectiva>","expires_at":"<UTC ISO-8601 posterior, máximo 14 días>"}
```

No establecer fechas antes de la aprobación efectiva. La comprobación usa el reloj UTC del job: rechaza aprobación futura, vencimiento alcanzado, ventana mayor a 14 días y cualquier `approved_by` diferente. Al vencer, retirar la variable o dejar que el gate falle; la revocación manual inmediata consiste en vaciarla. Como el PR ejecuta código de la rama, Jhan debe revisar cambios del gate y del workflow antes de fijar la variable. Esta variable no contiene credenciales ni da acceso a Railway.

**Límite adicional:** el ImageID de una reconstrucción Git de Railway puede diferir del ImageID escaneado en Actions. No desplegar hasta poder demostrar identidad de la imagen QA efectivamente ejecutada, o reescanear y aprobar su digest inmutable mediante un mecanismo de publicación controlado. `Wait for CI` por sí solo no prueba identidad. Los permisos DI-232 del modelo derivado para Railway siguen siendo decisión documental separada.
