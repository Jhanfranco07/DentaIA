# E2E público

En Ubuntu, el job instala las dependencias opcionales con `npm ci --include=optional` y comprueba que el binario SWC de Linux fijado por el lockfile existe antes de activar la guarda de red. Si falta, el job falla durante la preparación; Next.js no puede descargarlo durante las pruebas.

La entrada SWC Linux del lockfile usa la integridad publicada para la versión 15.5.29. Un hash previo distinto, heredado de `origin/main`, impedía su instalación en Ubuntu y provocaba que Next.js intentara descargarlo durante la suite; la guarda rechazó ese intento. Solo se actualizó la integridad, no la versión.

La ejecución #421 del pipeline integral en GitHub Actions verificó Ubuntu: regresión 1/1, Playwright 12/12, `tests-resumen` y los Quality Gates finales exitosos. La evidencia está en `https://github.com/Jhanfranco07/DentaIA/actions/runs/45133051850`. La ejecución local de Windows no sustituye esta verificación de CI.

Actualización para publicación: Chromium recibe `HOME` únicamente desde la lista permitida de variables del sistema. El job `tests-playwright` exige archivos de reporte cuando falla; `if-no-files-found: error` evita que una carga vacía parezca válida. Ninguno de estos cambios transmite credenciales ni altera los demás artefactos del pipeline.

La suite valida páginas reales de Next.js con Chromium. El `globalSetup` inicia y detiene exclusivamente el servidor local de esta corrida. No requiere cuentas, Supabase ni claves de servicios. Conserva los 10 casos iniciales y añade la guía pública de buenas prácticas y el estado de error seguro de una ficha.

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

En Ubuntu CI, antes de la suite, ejecutar `./node_modules/.bin/playwright install --with-deps chromium` y `node --test e2e/isolation/*.test.cjs`. El CLI proviene de `npm ci` y queda fijado por `package-lock.json`; no se descarga una versión arbitraria del paquete. En PowerShell, usar `npm.cmd` para los scripts de npm si la política bloquea `npm.ps1`.

El job `tests-playwright` usa Node 22 y un worker en CI. Forma parte de `tests-resumen`: su fallo, cancelación u omisión hace fallar ese Quality Gate y la validación integral dependiente. En caso de fallo se suben durante siete días `playwright-report/` y `test-results/`, que contienen solo datos ficticios de estas pruebas; no se pasan secretos al job. La instalación previa requiere el registro npm y los paquetes de Chromium, pero la suite ejecuta Next y Chromium con las restricciones de red descritas abajo.

`e2e/isolation/fixtures.json` es la única fuente de la URL y clave ficticias de Supabase para lanzador, prueba de preflight, proxy y tests. `NODE_OPTIONS` carga la guarda con ruta entre comillas y separadores compatibles con Windows y Linux. El preflight verifica que la guarda ya se cargó antes de cualquier conexión. La regresión crea temporalmente una ruta con espacios y comprueba que la guarda bloquea un intento TCP externo simulado. El servidor registra el PID que abre el puerto dedicado; el cierre de Windows solo termina ese PID si sigue escuchando en ese puerto. Los WebSockets se permiten únicamente con protocolo `ws:`, destino local exacto y ruta HMR sin query ni credenciales.

El foco por teclado se valida sobre el enlace «Ir al contenido» y se comprueba que Enter llega a `#contenido`. La suite cubre 12 casos públicos: portada, cuenta, privacidad, directorio y búsqueda, dos estados de ficha, guía de buenas prácticas, premium informativo, guía de análisis, dos rutas que solicitan sesión y menú móvil. No valida autenticación real, pagos, Supabase remoto ni inferencia de IA.

La ejecución local comprobó 12/12 E2E, 1/1 regresiones, typecheck, build y 116/116 pruebas Vitest. En la fase final, `npm audit --package-lock-only --ignore-scripts` y su variante `--omit=dev` respondieron con 0 vulnerabilidades; el intento de la fase anterior había sido inconcluso por falta de acceso al registro. WSL devolvió acceso denegado y no se pudo ejecutar Ubuntu ni GitHub Actions localmente. El script `scripts/ci/lint.mjs` retorna éxito, pero informa que ESLint no está configurado: este resultado no acredita lint real. El CI conserva sus verificaciones de TypeScript y SAST. FastAPI S-01 es un riesgo preexistente ajeno a esta rama. La guarda Node y el proxy del navegador cubren las rutas de red usadas por esta suite, pero no equivalen a un sandbox del sistema operativo para código nativo o procesos independientes.

En Windows, usar `npm.cmd` si PowerShell impide ejecutar `npm.ps1`. El puerto predeterminado es 43117; si está ocupado, definir `E2E_PORT` con un puerto local libre. Playwright nunca reutiliza un servidor existente.

El lanzador `e2e/isolation/start-next.cjs` construye un entorno por lista permitida: no hereda credenciales, exige que no existan archivos `.env` locales y fija Supabase a `127.0.0.1:1` con una clave ficticia. Desactiva las banderas clínicas, administrativas, de escritura y de pagos. Antes de iniciar Next, `probe.cjs` verifica con un centinela sintético que el entorno se depuró y que las conexiones externas por `net`, TLS, UDP, DNS y `fetch` se bloquean. La guarda se precarga también en los procesos Node hijos mediante `NODE_OPTIONS`. Cada intento bloqueado del servidor queda registrado en un archivo temporal; el cierre falla si aparece alguno. La consulta fija de Next dev al registro npm para conocer su propia versión se responde localmente, sin red.

En Chromium se bloquean Service Workers. Un proxy local sin servicio impide la salida de red incluso ante un redireccionamiento que el interceptor HTTP no vuelva a ver. La ruta a nivel de contexto permite solamente lecturas al origen local; responde de forma ficticia a las lecturas Supabase y a la RPC de consulta del directorio, y entrega una tesela PNG local al host exacto de OpenStreetMap. Los demás destinos y métodos se bloquean y hacen fallar la prueba. El WebSocket local de HMR se simula; cualquier otro WebSocket se bloquea. Se comprueban además excepciones JavaScript, errores de consola, solicitudes fallidas y respuestas HTTP inesperadas. Las pruebas no envían formularios, fotografías, solicitudes ni pagos.

El bloqueo de sockets del servidor cubre los caminos de red de Node usados por esta aplicación; no es una frontera de seguridad contra código nativo malicioso o procesos arbitrarios independientes. Para una garantía de sistema operativo, ejecutar la suite también dentro de un contenedor o sandbox sin salida de red. El navegador recibe páginas reales, pero la integración con Supabase y las teselas del mapa se simulan deliberadamente.

La salida HTML se guarda en `playwright-report/` y las capturas y trazas de fallos en `test-results/`; ambos directorios están ignorados por Git. Las pruebas autenticadas futuras deben vivir fuera de `e2e/public/` y usar una configuración y datos aislados.
En algunos controladores gráficos de Windows, Chromium también escribe `debug.log` en el directorio actual; Git lo ignora. Ese archivo no es parte de la evidencia de las pruebas y se puede eliminar al cerrar la corrida.
