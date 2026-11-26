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

La configuración del workflow pasó validación YAML/DAG y actionlint local. El gate tuvo pruebas de política locales; la ejecución completa de Trivy en GitHub Actions sigue sin comprobarse porque la rama no se ha publicado.
