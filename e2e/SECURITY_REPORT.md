# Seguridad E2E: estado final e historial de fases

## Estado final verificado

El commit `fe301faf08eac04408f8247a65e98b0fe743d656` del [PR #112](https://github.com/Jhanfranco07/DentaIA/pull/112) pasó la [ejecución DevSecOps #422](https://github.com/Jhanfranco07/DentaIA/actions/runs/45133429576): **30/30 jobs exitosos**, Playwright **12/12 en 41,1 s** en Ubuntu, regresión de aislamiento **1/1**, `tests-resumen` y Quality Gates finales exitosos. La [ejecución #421](https://github.com/Jhanfranco07/DentaIA/actions/runs/45133051850) también terminó con 30/30 jobs y Playwright 12/12 (47,8 s). Estos resultados no implican cobertura total de funcionalidades ni seguridad absoluta. El inventario, la arquitectura y los límites actuales están consolidados en [DI-136 — Playwright y DevSecOps](../docs/qa/DI-136-playwright-devsecops.md).

Las secciones siguientes conservan el diagnóstico cronológico. Las frases sobre comprobaciones «pendientes» o archivos «sin modificar» describen el momento de cada fase, no el estado final. En la publicación del PR se corrigió **solo la integridad** de `@next/swc-linux-x64-gnu@15.5.29` en `package-lock.json`; no se cambió su versión. El S-01 de FastAPI procede de un informe histórico fuera del alcance Playwright. En #422 `pip-audit` y el Security Quality Gate pasaron; esta documentación no reevalúa el aviso individual de FastAPI ni lo atribuye al PR. Las auditorías npm corresponden a JavaScript y son una verificación distinta.

## Diagnóstico de GitHub Actions en el PR #112

La primera ejecución Ubuntu de `tests-playwright` falló antes de abrir Next.js y ocultó la salida del launcher. Se añadió captura acotada de diagnóstico; la segunda ejecución mostró que Next.js intentaba descargar `@next/swc-linux-x64-gnu` desde npm. La guarda bloqueó esa salida como estaba previsto. El job solicita ahora explícitamente dependencias opcionales en `npm ci` y verifica la presencia del binario SWC de Linux antes de activar el aislamiento. No se relaja la guarda.

La tercera ejecución mostró que `npm ci --include=optional` rechazó dos veces el tarball SWC por integridad y dejó el paquete ausente. La entrada de `package-lock.json` para `@next/swc-linux-x64-gnu@15.5.29` tenía el hash `sha512-WXCf...`, también presente en `origin/main`; `npm view` contra `https://registry.npmjs.org/` devolvió `sha512-5WqW...` para esa misma versión. Se corrigió únicamente ese hash del lockfile, sin cambiar versión ni dependencias. El job mantiene el fail closed antes de iniciar la suite.

La ejecución #421 de DevSecOps en GitHub Actions, sobre `491d54c7844b902e0120bb27f62903c5de8793a4`, confirmó en Ubuntu: verificación SWC exitosa, regresión 1/1, Playwright 12/12, `tests-resumen` exitoso, Quality Gates de seguridad y CI exitosos e integración de calidad y pruebas exitosa. Los 30 jobs registrados finalizaron con éxito. Evidencia: `https://github.com/Jhanfranco07/DentaIA/actions/runs/45133051850`.

## Fase 7: observaciones finales de Claude

`playwright.config.ts` incluye `HOME` en la lista permitida para Chromium en Ubuntu. Se copia solo esa variable de ruta y se mantienen fuera las credenciales y variables de servicio. En Windows, cuando `HOME` no existe, la configuración conserva el funcionamiento anterior. El job `tests-playwright` exige ahora los artefactos de fallo mediante `if-no-files-found: error`; los demás jobs y sus políticas de artefactos no cambiaron. La corrida local con `CI=true` pasó 12/12; la regresión de la guarda pasó 1/1, TypeScript pasó, Vitest pasó 116/116 y el build aislado pasó con advertencias CSS preexistentes. `npm audit --package-lock-only --ignore-scripts` y su variante `--omit=dev` respondieron con 0 vulnerabilidades. El DAG se verificó localmente; YAML/actionlint y Ubuntu se comprobaron después en #421 y #422, pues esas herramientas no estaban disponibles localmente en Windows.

## Fase 5: correcciones de Claude e integración DevSecOps

- **B-01:** `NODE_OPTIONS` cita la ruta de la guarda y normaliza separadores Windows. El preflight comprueba un marcador fijado por la precarga antes de abrir sockets. La regresión usa una ruta temporal con espacios y demuestra el bloqueo de TCP externo; 1/1 pasa. La primera ejecución de esa regresión falló y reveló que Node eliminaba las barras invertidas, lo que motivó la normalización.
- **B-04/B-05:** `fixtures.json` concentra URL y clave ficticias; los tests validan explícitamente `baseURL` y rechazan cualquier destino distinto de HTTP local, sin aserciones no nulas ni fallback remoto.
- **C-01/C-02/C-03/C-04:** el test de teclado exige foco visible en «Ir al contenido» y activación con Enter; CI usa un worker; la guarda registra el PID que abrió el puerto y Windows solo termina ese PID si aún es el listener; el WebSocket permitido exige `ws:`, host, puerto y ruta exactos sin query ni credenciales.
- **Pipeline:** `tests-playwright` usa Ubuntu, Node 22, acciones fijadas por SHA, `npm ci`, Chromium del Playwright fijado por lockfile, regresión de aislamiento, suite E2E y artefactos solo ante fallo. Depende de `tests-preparacion` y es dependencia obligatoria de `tests-resumen`, cuyo `summary.py --gate` exige éxito de cada `needs`. La validación integral ya depende de `tests-resumen`.
- **Resultados locales de fase 5:** E2E 12/12; regresión 1/1; preflight pasó; TypeScript pasó; build pasó con advertencias CSS/autoprefixer existentes; Vitest 19 archivos y 116/116 pruebas; `node scripts/ci/lint.mjs` salió 0 pero no ejecuta ESLint; `git diff --check` salió 0 con advertencias de normalización LF/CRLF. En esa fase `npm audit` fue inconcluso y Ubuntu/Actions no pudo ejecutarse localmente. La fase 7 repitió las auditorías npm con 0 hallazgos y #421/#422 validaron Ubuntu en GitHub Actions.
- **Corrección durante la validación:** una corrida intermedia con `CI=true` terminó 11/12 porque la aserción de foco esperaba `transform: matrix(...)` mientras Chromium devolvía `none` para el enlace ya visible. Se cambió a foco y visibilidad del enlace concreto más activación con Enter; la corrida completa posterior con un worker terminó 12/12.
- **Pendientes:** S-01 corresponde al FastAPI preexistente del backend y requiere corrección coordinada separada. El bloqueo de red Node/Chromium no es un sandbox del sistema operativo frente a código nativo o procesos independientes. Ninguna prueba de esta suite acredita autenticación real, pagos, IA ni integración remota. No se cambió FastAPI, RLS, CSP, Quality Gates existentes ni dependencias.

## Resumen histórico de fase 4

Revisión realizada en `test/playwright-public`, HEAD inicial `8db8fa1f1d34cff1d0814b2a352fdb60cf7f091c`, con `origin/main` como ancestro. Las 10 pruebas originales se conservaron y se añadieron 2 casos. No se modificaron dependencias, backend de IA, RLS, CSP ni workflows. No se creó commit ni se contactaron servicios de producción.

## Correcciones

1. **S-02, servidor.** `global-setup.cjs` exige un puerto libre y arranca Next.js con un entorno construido por lista permitida. `start-next.cjs` rechaza archivos `.env` locales, fija Supabase a `127.0.0.1:1` con clave ficticia, desactiva banderas clínicas, administrativas, de escritura y de pagos, y precarga `network-guard.cjs` en cada proceso Node. La guarda bloquea destinos fuera de loopback para `fetch`, conexiones TCP/TLS, UDP y resolución DNS. Un intento bloqueado se registra en un archivo temporal y hace fallar el cierre de la suite. La consulta exacta de Next dev a los dist-tags de npm se responde localmente. `probe.cjs` comprueba el saneamiento y el bloqueo antes de servir la aplicación. El cierre detiene el listener que creó la corrida.
2. **S-03, navegador.** `playwright.config.ts` bloquea Service Workers, aplica un proxy local sin servicio como segunda barrera de salida y arranca Chromium con entorno mínimo. La fixture de `smoke.spec.ts` intercepta HTTP a nivel de contexto, incluidas ventanas emergentes; solo permite lecturas del origen local y simulaciones exactas de Supabase y teselas. Bloquea los demás métodos y destinos. El WebSocket local de HMR se simula y los demás se bloquean.
3. **S-04, señales de fallo.** La fixture distingue el 503 ficticio de Supabase de errores inesperados. Falla por excepciones JavaScript, errores de consola no simulados, solicitudes fallidas, respuestas HTTP >=400 no previstas y solicitudes bloqueadas. Las dos pruebas nuevas verifican el error seguro de una ficha y la guía pública de buenas prácticas.

## Evidencia y comandos

| Comando | Resultado |
|---|---|
| `node e2e/isolation/start-next.cjs 43117 --verify` con centinela sintético | Pasa: centinela no heredado; TCP, TLS, UDP, DNS y `fetch` externos bloqueados antes de conectar. |
| `npm.cmd run test:e2e -- --reporter=line` | 12/12 pasan; cierre sin intentos externos registrados. |
| `npm.cmd run typecheck` | Pasa. |
| `node scripts/ci/lint.mjs` | Salida 0, pero informa que ESLint no está configurado; **no acredita lint real**. |
| `node e2e/isolation/start-next.cjs 43117 --build` | Pasa; advertencias CSS/autoprefixer preexistentes. |
| `node e2e/isolation/start-next.cjs 43117 --unit` | Vitest: 19 archivos y 116 pruebas pasan. |
| `npm.cmd audit --package-lock-only --ignore-scripts` y variante `--omit=dev` | Fase 4: sin respuesta del registro. Fase 7: ambas consultas devolvieron 0 vulnerabilidades. No se ejecutó `audit fix`. |
| `git diff --check` | Sin errores de espacios; Git avisó que normalizará LF a CRLF en algunos archivos. |

La primera corrida E2E falló por un método incorrecto del controlador WebSocket. Después, 8/10 pasaron: dos pruebas fallaron porque la consola informó los 503 ficticios esperados. Tras corregirlo, 10/10 pasaron. La instrumentación nueva detectó luego un intento de Next dev al registro npm y falló correctamente la corrida de 12; la respuesta local específica resolvió ese intento y la siguiente corrida pasó 12/12. Una estrategia inicial de arranque dejó colgado el cierre en Windows; `globalSetup` lo sustituyó y el cierre final pasa.

## Pendientes y límites

- **S-01, registro histórico de fase 4:** se señaló FastAPI 0.135.2 en `services/dental-vision/requirements.txt` frente a GHSA-f56c-v883-vx8r. La versión fijada sigue en ese archivo, pero `pip-audit` y el gate de seguridad de #422 pasaron. Este documento no presenta S-01 como vulnerabilidad actual confirmada; el equipo del backend debe reconciliar el aviso y el resultado del pipeline por separado.
- La consulta npm de fase 4 no permitió enumerar vulnerabilidades; la repetición de fase 7 devolvió 0. Hasta la fase 4 no se habían agregado ni actualizado paquetes ni cambiado `package-lock.json`. Posteriormente se corrigió solo la integridad SWC Linux y el gate de CI de #422 pasó.
- La guarda de Node protege los caminos de red usados por la aplicación, pero no constituye un sandbox de sistema operativo contra código nativo malicioso o procesos arbitrarios. Para esa garantía, ejecutar también en un contenedor o sandbox sin salida de red.
- Las pruebas simulan Supabase y teselas; no acreditan autenticación real, pagos, análisis de IA ni integración remota.
- En algunos controladores Windows, Chromium escribe `debug.log` con mensajes de GPU; está ignorado por Git y no forma parte del PR.

## Recomendación histórica de fase 4 para DevSecOps (implementada)

La propuesta de fase 4 era añadir un job E2E público que instalara Chromium, ejecutara `npm run test:e2e`, conservara informe y trazas ante fallos y exigiera su resultado en el Quality Gate, manteniendo `npm audit --omit=dev`, `pip-audit` y los demás controles. La implementación vigente se describe en el documento DI-136 y fue comprobada por #422. La defensa técnica combina entorno y sockets del servidor restringidos con intercepción y proxy del contexto Chromium; sus límites constan arriba.
