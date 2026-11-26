# DI-211 · Imagen RF-DETR y gate de seguridad

Estado local al 26 de noviembre de 2026: `dentaia-rfdetr-di211-service:local` se construyó sin pesos con la base `python:3.11-slim@sha256:61e01f72680f86a5279ad510818ab7b2ee9f049822589d4e34e33e044360356c`. Docker Scout encontró 0 críticos y 3 altos en OpenSSL Debian `3.5.9-1~deb13u1`: CVE-2026-107493, CVE-2026-84786 y CVE-2026-107496. El consentimiento de riesgo existente cubre solo un smoke local offline, no publicación ni uso clínico.

## Búsqueda acotada de base

| Candidata | Evidencia | Decisión |
| --- | --- | --- |
| Debian Trixie actual | [El tracker Debian](https://security-tracker.debian.org/tracker/source-package/openssl) marca los tres CVE vulnerables en `3.5.9-1~deb13u1`. | No sustituir por otro digest Trixie sin comprobar versión y nuevo escaneo. |
| Debian Bookworm | [El tracker Debian](https://security-tracker.debian.org/tracker/source-package/openssl) también marca vulnerables sus paquetes OpenSSL 3.0. | Mantendría compatibilidad glibc, pero no demuestra corrección. |
| Ubuntu LTS | [CVE-2026-107493](https://ubuntu.com/security/CVE-2026-107493) y [CVE-2026-84786](https://ubuntu.com/security/CVE-2026-84786) siguen en evaluación para OpenSSL. | No hay corrección verificable para fijar una imagen nueva. |
| Alpine | [Alpine v3.22](https://pkgs.alpinelinux.org/packages?branch=v3.22&name=openssl) publica OpenSSL `3.5.9-r2`; los 59 wheels ML fijados son para glibc/manylinux, no para musl. | No se considera un reemplazo compatible sin reconstruir y revalidar todo el lock. |
| Chainguard | Sus [avisos](https://images.chainguard.dev/directory/image/actions-runner/advisories) mantienen las correcciones OpenSSL pendientes. | Sin imagen Python y digest que acrediten corrección y compatibilidad del lock. |

[OpenSSL](https://openssl-library.org/news/vulnerabilities-3.5/) identifica versiones corregidas posteriores a 3.5.9; esto no acredita que el proveedor de la imagen ya las publique. No se cambió la base, el checkpoint ni el lock.

## Gate añadido al pipeline maestro

`sec-imagen-rfdetr` construye la imagen sin publicarla y usa Trivy fijado por SHA para escanear paquetes del sistema y Python. Exige inventario de ambos y la identidad exacta de imagen. En PR aplica la [excepción acotada de revisión](OPENSSL_CVE_2026_DI211_IMAGE.md), aún pendiente de aprobación humana: únicamente los tres CVE OpenSSL documentados, en el paquete y versión concretos y sin `FixedVersion`, se informan como advertencia. Cualquier otro HIGH o CRITICAL bloquea. En pushes a `main`/`develop` y ejecuciones manuales aplica el modo despliegue: los tres CVE y la versión Debian vulnerable bloquean incluso si Trivy los clasifica de otro modo u omite temporalmente sus avisos. Un error del escáner o una cobertura incompleta bloquean ambos modos. El job alimenta `sec-quality-gate`.

La configuración del workflow pasó validación YAML/DAG y actionlint local. La primera ejecución completa de Trivy en el [PR #121](https://github.com/Jhanfranco07/DentaIA/pull/121) encontró 231 registros de CVE y falló. El 26 de noviembre se repitió localmente con Trivy 0.76.2 sobre un tar exportado de `dentaia-rfdetr-di211-service:local`: 231 registros, 54 bloqueos del gate de revisión y 64 del gate de despliegue. El JSON original se conserva fuera de Git en `%TEMP%\di211-rfdetr-service-trivy.json`; el gate local recibió una copia cuyo único cambio semántico fue `ArtifactName=dentaia-rfdetr-ci:local`, porque Trivy identifica `--input` por la ruta del tar. El manifiesto del tar confirma la etiqueta de la imagen. El pipeline CI analiza directamente la imagen etiquetada y el cambio pendiente configura la conservación del JSON completo como artefacto `rfdetr-image-trivy` en la próxima ejecución.

Los 54 registros HIGH representan 14 CVE distintos: cuatro de util-linux (`CVE-2026-76642`, `CVE-2026-78408`, `CVE-2026-78409`, `CVE-2026-78410`), `CVE-2025-69720` en ncurses, tres de SQLite (`CVE-2026-119373`, `CVE-2026-119374`, `CVE-2026-119379`), dos adicionales de OpenSSL (`CVE-2026-107494`, `CVE-2026-124709`), `CVE-2026-16742` en systemd, `CVE-2026-54369` en libacl, `CVE-2026-9538` en Perl y `CVE-2026-124851` en libzstd. Trivy informa corrección disponible solo para libzstd entre esos registros. No se encontró una vulnerabilidad Python HIGH. Los 54 bloqueos no se convirtieron en advertencias.

La base oficial `python:3.11-slim-bookworm` se escaneó por separado con el mismo Trivy y registró 104 hallazgos HIGH; no resuelve el bloqueo. Docker Hardened Python 3.11 anuncia una variante Debian 13 con parches adicionales, pero `dhi.io/python:3.11-debian13` devolvió HTTP 401 sin acceso al registro, por lo que no se pudo construir ni verificar el servicio completo sobre esa base. Ni el número de CVE anunciado por un proveedor ni el escaneo de una base aislada sustituyen el escaneo de la imagen final y sus imports, operadores e inferencia.
