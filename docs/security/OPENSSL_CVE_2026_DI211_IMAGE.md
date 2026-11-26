# DI-211 · Excepción de revisión solicitada para tres CVE de OpenSSL

**Estado al 26 de noviembre de 2026:** pendiente de aprobación del responsable del proyecto. Esta excepción permite revisar un PR; no aprueba merge, despliegue, uso clínico ni aceptación del riesgo de producción. La única aceptación previa cubrió un smoke local offline.

El Docker Scout local de `dentaia-rfdetr-di211-service:local` informó tres hallazgos HIGH en OpenSSL Debian `3.5.9-1~deb13u1`: CVE-2026-107493, CVE-2026-84786 y CVE-2026-107496. El primer escaneo completo en GitHub Actions del [PR #121](https://github.com/Jhanfranco07/DentaIA/pull/121) encontró **231 registros de CVE y 63 hallazgos bloqueantes** con Trivy. Incluye otros HIGH de OpenSSL (`CVE-2026-107494` y `CVE-2026-124709`), `libzstd1` con corrección disponible y otros paquetes Debian sin `FixedVersion`. Por ello el gate de revisión sigue fallando. Conservar el [reporte de imagen](DI211_RFDETR_IMAGE_GATE.md) y comprobar el [tracker de Debian](https://security-tracker.debian.org/tracker/source-package/openssl) y los [avisos de OpenSSL](https://openssl-library.org/news/vulnerabilities-3.5/) antes de cualquier decisión posterior. En la fecha indicada no se verificó un paquete Debian corregido compatible con el lock ML.

## Dos decisiones distintas en el pipeline maestro

| Control | Alcance | Resultado con la imagen actual |
| --- | --- | --- |
| `--mode review` en `pull_request` | Excepción **solo** para esos tres identificadores, en `openssl`, `libssl3t64` u `openssl-provider-legacy` versión exacta `3.5.9-1~deb13u1`, sin `FixedVersion` en el informe. Otros HIGH y todos los CRITICAL bloquean, tengan o no parche. | La excepción se registra como advertencia; el PR actual sigue bloqueado por otros HIGH. |
| `--mode deploy` en `push` a `main`/`develop` o `workflow_dispatch` | Bloquea cualquier HIGH/CRITICAL y la versión OpenSSL vulnerable aunque falten avisos en Trivy. | Falla; no autoriza publicar la imagen RF-DETR en un destino remoto. |

El gate exige que Trivy cubra paquetes Debian y Python y que haya escaneado la imagen exacta. Si Trivy informa cualquiera de los tres CVE con paquete o versión distintos, una severidad CRITICAL o una versión corregida disponible, la excepción de revisión deja de aplicar. La presencia de la versión Debian vulnerable se muestra aunque la base de avisos no incluya los tres registros. No se omiten resultados ni se usa `ignore-unfixed`.

El dictamen de revisión debe registrar, para este PR y commit exactos, la aceptación o rechazo por el responsable de seguridad/proyecto de los tres CVE, la fecha y el alcance. La ausencia de esa decisión impide declarar el riesgo aprobado. Resolver o sustituir la base vulnerable y repetir el escaneo es requisito para desplegar el contenedor. RF-DETR y la ingesta HMAC permanecen deshabilitados por defecto.

## Límite del control

GitHub Actions no despliega esta imagen: los pasos `entrega-publicacion` observan estados externos de Vercel y Railway. Un gate de Actions por sí solo no detiene una integración Git externa que despliegue antes o al margen de los checks. El workflow maestro solo se dispara en pushes a `main`/`develop`, PR hacia esas ramas y ejecución manual; un push directo a la rama DI-211 no ejecuta el gate. Antes de publicar la rama se debe verificar en los proyectos conectados que ese push no inicia un despliegue no autorizado de RF-DETR. No se verificó esa configuración externa desde este repositorio.
