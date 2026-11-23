# Fase 4: cierre de S-02, S-03 y S-04

## Fase 7: observaciones finales de Claude

`playwright.config.ts` incluye `HOME` en la lista permitida para Chromium en Ubuntu. Se copia solo esa variable de ruta y se mantienen fuera las credenciales y variables de servicio. En Windows, cuando `HOME` no existe, la configuración conserva el funcionamiento anterior. El job `tests-playwright` exige ahora los artefactos de fallo mediante `if-no-files-found: error`; los demás jobs y sus políticas de artefactos no cambiaron. La corrida final local con `CI=true` pasó 12/12; la regresión de la guarda pasó 1/1, TypeScript pasó, Vitest pasó 116/116 y el build aislado pasó con advertencias CSS preexistentes. `npm audit --package-lock-only --ignore-scripts` y su variante `--omit=dev` respondieron con 0 vulnerabilidades. El DAG local se verificó; la validación completa YAML/actionlint y la ejecución Ubuntu quedan pendientes de GitHub Actions por falta de esas herramientas en Windows.

## Fase 5: correcciones de Claude e integración DevSecOps

- **B-01:** `NODE_OPTIONS` cita la ruta de la guarda y normaliza separadores Windows. El preflight comprueba un marcador fijado por la precarga antes de abrir sockets. La regresión usa una ruta temporal con espacios y demuestra el bloqueo de TCP externo; 1/1 pasa. La primera ejecución de esa regresión falló y reveló que Node eliminaba las barras invertidas, lo que motivó la normalización.
- **B-04/B-05:** `fixtures.json` concentra URL y clave ficticias; los tests validan explícitamente `baseURL` y rechazan cualquier destino distinto de HTTP local, sin aserciones no nulas ni fallback remoto.
- **C-01/C-02/C-03/C-04:** el test de teclado exige foco visible en «Ir al contenido» y activación con Enter; CI usa un worker; la guarda registra el PID que abrió el puerto y Windows solo termina ese PID si aún es el listener; el WebSocket permitido exige `ws:`, host, puerto y ruta exactos sin query ni credenciales.
- **Pipeline:** `tests-playwright` usa Ubuntu, Node 22, acciones fijadas por SHA, `npm ci`, Chromium del Playwright fijado por lockfile, regresión de aislamiento, suite E2E y artefactos solo ante fallo. Depende de `tests-preparacion` y es dependencia obligatoria de `tests-resumen`, cuyo `summary.py --gate` exige éxito de cada `needs`. La validación integral ya depende de `tests-resumen`.
- **Resultados locales:** E2E 12/12; regresión 1/1; preflight pasó; TypeScript pasó; build pasó con advertencias CSS/autoprefixer existentes; Vitest 19 archivos y 116/116 pruebas; `node scripts/ci/lint.mjs` salió 0 pero no ejecuta ESLint; `git diff --check` salió 0 con advertencias de normalización LF/CRLF. `npm audit --omit=dev` no devolvió hallazgos porque falló la petición al registro. Ubuntu/Actions y los validadores Python/actionlint no pudieron ejecutarse en este Windows: WSL respondió acceso denegado y no hay Python ni actionlint instalados.
- **Corrección durante la validación:** una corrida intermedia con `CI=true` terminó 11/12 porque la aserción de foco esperaba `transform: matrix(...)` mientras Chromium devolvía `none` para el enlace ya visible. Se cambió a foco y visibilidad del enlace concreto más activación con Enter; la corrida completa posterior con un worker terminó 12/12.
- **Pendientes:** S-01 corresponde al FastAPI preexistente del backend y requiere corrección coordinada separada. El bloqueo de red Node/Chromium no es un sandbox del sistema operativo frente a código nativo o procesos independientes. Ninguna prueba de esta suite acredita autenticación real, pagos, IA ni integración remota. No se cambió FastAPI, RLS, CSP, Quality Gates existentes ni dependencias.

## Resumen

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

- **S-01 preexistente:** `services/dental-vision/requirements.txt` fija FastAPI 0.135.2 dentro del rango de GHSA-f56c-v883-vx8r (severidad alta). Requiere corrección coordinada fuera de este alcance.
- La consulta npm de fase 4 no permitió enumerar vulnerabilidades; la repetición de fase 7 devolvió 0. No se agregaron ni actualizaron paquetes ni se cambió `package-lock.json`. El gate de CI repetirá su propia auditoría.
- La guarda de Node protege los caminos de red usados por la aplicación, pero no constituye un sandbox de sistema operativo contra código nativo malicioso o procesos arbitrarios. Para esa garantía, ejecutar también en un contenedor o sandbox sin salida de red.
- Las pruebas simulan Supabase y teselas; no acreditan autenticación real, pagos, análisis de IA ni integración remota.
- En algunos controladores Windows, Chromium escribe `debug.log` con mensajes de GPU; está ignorado por Git y se elimina al cerrar la revisión.

## Recomendación para DevSecOps

Añadir un job E2E público después de `npm ci`, typecheck y build: instalar Chromium de Playwright, ejecutar `npm run test:e2e`, conservar informe, trazas y capturas como artefactos cuando falle, y exigir el resultado en el Quality Gate existente. Mantener el `npm audit --omit=dev`, `pip-audit` y los demás gates actuales; no permitir credenciales de producción en el job E2E. La defensa técnica es doble: entorno y sockets del servidor restringidos, y contexto de Chromium interceptado con proxy sin salida.
