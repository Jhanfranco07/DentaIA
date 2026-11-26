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

La base oficial `python:3.11-slim-bookworm` se escaneó por separado con el mismo Trivy y registró 104 hallazgos HIGH; no resuelve el bloqueo. Se obtuvo acceso posterior a Docker Hardened Python 3.11 y se fijó el digest `sha256:565c3f965a7d3a5b250453c9b86724ba87f31675f48b9b9e759d5d70fe98af8c`. El escaneo local de **esa base sola** con Trivy 0.76.2 encontró 21 registros HIGH: libexpat, ncurses, SQLite, OpenSSL y libuuid/util-linux; ninguno tenía `FixedVersion` en el JSON. El reporte íntegro está fuera de Git en `C:\Users\USER\DentaIA-ML-Artifacts\DI-211-runtime-qa\di211-dhi-base-trivy-20261126.json` (SHA-256 `e308b8886ae7939266348c7c293b5a055d7a0ca317fe2cebd4f47dd05bbc26a5`). Trivy advirtió que el SBOM de terceros podría afectar la exactitud; no se omitió ningún hallazgo. La base ya falla el criterio estricto, por lo que no se construyó una nueva imagen de servicio sobre ella. Ni el número de CVE anunciado por un proveedor ni el escaneo de una base aislada sustituyen el escaneo de la imagen final y sus imports, operadores e inferencia.

[OpenSSL anunció](https://www.openwall.com/lists/oss-security/2026/11/24/14) la versión 3.5.10 de seguridad para el 1 de diciembre de 2026; al 26 de noviembre no está disponible como paquete Debian Trixie verificado. No se incorporan parches o binarios no publicados para eludir el gate.

## Corrección comprobada y clasificación por vulnerabilidad única

El 26 de noviembre se reconstruyó `dentaia-rfdetr-ci:local` con `libzstd1=1.5.7+dfsg-1+deb13u1`, la única `FixedVersion` de los 54 HIGH anteriores. El paquete procede de `trixie-security`; los imports de PyTorch 2.15.0+cpu, torchvision 0.29.2+cpu, OpenCV 5.0.0, RF-DETR y FastAPI, y el operador NMS pasaron en un contenedor sin red y con `/tmp` temporal. No se montó el checkpoint. El JSON íntegro de Trivy 0.76.2 queda en `%TEMP%\di211-rfdetr-ci-libzstd-fixed-trivy.json` (SHA-256 `FA23A0BCF895C9145334EE8FD36906FFEB0D356228DB45BAFDD19695E6994AA9`). El tar conserva la etiqueta `dentaia-rfdetr-ci:local`; para ejecutar el gate con `--input` se creó una copia del JSON que cambia solo `ArtifactName` al nombre de esa etiqueta.

El nuevo reporte contiene 230 registros CVE. Quedan **53 registros HIGH, 13 CVE únicos y ningún HIGH de paquetes Python**. Los 53 son bloqueos del gate PR; ninguno informa `FixedVersion`. Agrupación sin contar repetidamente el mismo CVE como una vulnerabilidad distinta:

| Componente | CVE únicos | Registros HIGH | Estado |
| --- | --- | ---: | --- |
| util-linux y bibliotecas asociadas (`bsdutils`, `libblkid1`, `liblastlog2-2`, `libmount1`, `libsmartcols1`, `libuuid1`, `login`, `mount`, `util-linux`) | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 | 36 | Sin `FixedVersion` |
| ncurses (`libncursesw6`, `libtinfo6`, `ncurses-base`, `ncurses-bin`) | CVE-2025-69720 | 4 | Sin `FixedVersion` |
| SQLite (`libsqlite3-0`) | CVE-2026-119373, CVE-2026-119374, CVE-2026-119379 | 3 | Sin `FixedVersion` |
| OpenSSL (`libssl3t64`, `openssl`, `openssl-provider-legacy`) | CVE-2026-107494, CVE-2026-124709 | 6 | Sin `FixedVersion`; adicionales a los tres de la excepción acotada |
| systemd (`libsystemd0`, `libudev1`) | CVE-2026-16742 | 2 | Sin `FixedVersion` |
| ACL (`libacl1`) | CVE-2026-54369 | 1 | Sin `FixedVersion` |
| Perl (`perl-base`) | CVE-2026-9538 | 1 | Sin `FixedVersion` |

La ejecución del script **sin alterar sus reglas** devolvió `review: 230 registros, 53 bloqueos, exit 1` y `deploy: 230 registros, 63 bloqueos, exit 1`. Las salidas están en `%TEMP%\di211-gate-review-after-libzstd.txt` y `%TEMP%\di211-gate-deploy-after-libzstd.txt`. El despliegue continúa prohibido y el PR no tiene gate de seguridad aprobado.

## Alternativas mínimas ensayadas

Trivy 0.76.2 encontró 121 registros HIGH en la base `gcr.io/distroless/python3-debian12:nonroot` sola, incluidos Python 3.11 y Kerberos; no mejora el gate. `gcr.io/distroless/base-debian12:nonroot` tiene un HIGH de `libssl3` con corrección indicada; `base-nossl-debian12:nonroot` tiene cero HIGH en su base, pero carece de Python y SSL. Ningún resultado de base aislada demuestra que una imagen final con RF-DETR sea segura o funcional.

Se preparó fuera de Git `%TEMP%\di211-dhi-multistage.Dockerfile` (SHA-256 `DBD9F09D7D4953ED8A5AC932ACE71D70EFAB214601C0B35A4C576B25767B26AD`) para copiar solo el runtime ML y la app sobre Docker Hardened Python 3.11. La base ejecutó Python 3.11.18, pero ya tenía 21 HIGH en el escaneo previo. La construcción se canceló antes de completarse porque la RAM libre cayó a 0,04 GiB; no se atribuye compatibilidad al prototipo. La simulación de purga en la base actual marcó `bsdutils`, `login`, `ncurses-bin`, `perl-base` y `util-linux` como paquetes esenciales. No se eliminan a la fuerza ni se oculta su inventario para obtener un falso escaneo limpio. El siguiente ensayo necesita memoria suficiente y escaneo de la imagen **final**, seguido de imports, operadores y gate completo. Jhan debe mantener Railway sin activación hasta que una imagen final cumpla el modo `deploy` sin ampliar excepciones.
