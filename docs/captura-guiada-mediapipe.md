# Captura guiada de fotografías dentales

Incremento del 24 de noviembre de 2026 en `feat/captura-guiada-mediapipe`, con base `795baa88bd15bf1701615632c49e75354fa9be03`.

Jira confirmó la historia [DI-212 — Captura fotográfica asistida con MediaPipe](https://jhanfranco.atlassian.net/browse/DI-212) y su subtarea [DI-244 — Probar captura asistida en móvil y escritorio](https://jhanfranco.atlassian.net/browse/DI-244), ambas en curso al consultar. DI-122 pertenece al flujo anterior de carga con consentimiento.

## Decisiones técnicas

- El registro oficial confirmó que la etiqueta estable `latest` de `@mediapipe/tasks-vision` resolvía a `1.2.3`. El tarball de npm declara Apache-2.0 y se comprobó su SHA-512 contra `dist.integrity`. La versión exacta y la integridad quedan fijadas en el lockfile. [Historial oficial de npm](https://www.npmjs.com/package/@mediapipe/tasks-vision?activeTab=versions)
- El modelo oficial Face Landmarker float16 v1 se descargó de Google Cloud Storage, generación `1683136941916318`. Sus 3 758 596 bytes coinciden con el MD5 publicado en `x-goog-hash` y con el SHA-256 de la ficha del paquete completo enlazada por Google. La ficha declara Apache-2.0. El modelo original y una copia de la licencia se incluyen en `public/mediapipe/1.2.3/`. [Documentación de Google](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker#models) · [Ficha del modelo](https://huggingface.co/litert-community/MediaPipe-FaceLandmarker) · [Objeto oficial](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task?generation=1683136941916318)
- `scripts/preparar-mediapipe.mjs` valida los SHA-256 del modelo, SDK, cargador JS y WASM, transpila el worker con TypeScript y publica el runtime en el mismo origen. `transpileModule()` emite JavaScript sin comprobar tipos. El job TypeScript de `.github/workflows/devsecops.yml` ejecuta `npm run typecheck` con `tsc --noEmit`. El patrón `**/*.ts` de `tsconfig.json` incluye `guia.worker.ts` y `geometria.ts`. `npm run dev`, `npm run build` y `npm run test:e2e` ejecutan la preparación. El runtime generado queda fuera del repositorio. La primera activación descarga unos 19 MB sin compresión.
- El SDK se ejecuta en un worker de módulo con delegado CPU, un rostro, sin *blendshapes* ni matrices faciales. La cámara proporciona hasta un fotograma cada 150 ms, con el lado mayor limitado a 512 px y una sola inferencia en vuelo. La orientación usa la inclinación de la línea de la boca y la posición relativa de la nariz. La distancia se aproxima con el tamaño del rostro y la apertura con la separación de los labios relativa al ancho de la boca. El mensaje cambia tras tres señales consecutivas y se suaviza la posición del contorno.
- El navegador entrega los fotogramas orientados y la interfaz recalcula el área visible al cambiar sus dimensiones. La cámara frontal se espeja cuando el navegador informa `facingMode: user`. El JPEG conserva la orientación de los píxeles originales.
- La guía requiere un contexto seguro, WebAssembly, workers de módulo, `createImageBitmap` y `OffscreenCanvas` con WebGL en el worker. Google documenta Chrome, Edge, Firefox y Safari modernos. Se verificó Chromium de Playwright en Windows con tamaños de escritorio y móvil. Edge, Firefox, Safari y cámaras físicas quedan pendientes. [Configuración web de MediaPipe](https://developers.google.com/edge/mediapipe/solutions/setup_web)

| Recurso | SHA-256 |
| --- | --- |
| `face_landmarker.task` | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |
| `vision_bundle.mjs` | `fb0c02c296f44ce0cc324ba16bd646d8773eb4a7847db4019cc4d0430db7a9b5` |
| `vision_wasm_module_internal.js` | `d29996249490361715c769c6a49b43ad47e6ac9a28a8e8bce8d02b238e897851` |
| `vision_wasm_module_internal.wasm` | `a269e84b12aefc93c9d6a4d62b01f41e5434a9fa941533bb8e75b1e3d1669e46` |

## Privacidad

La inspección del SDK encontró un envío de métricas mediante `fetch` a `https://odml.pa.googleapis.com/v1/log`. El worker instala su control de red antes de importar el SDK. Acepta tres URL exactas en GET de mismo origen y rechaza redirecciones y referrer. Son las del modelo, el WASM y su cargador JS. Solo esas lecturas conservan las credenciales del mismo origen para que el navegador pueda presentar la sesión exigida por el Preview protegido. La URL del cargador es la misma que recibe `wasmLoaderPath`. La CSP del worker exige `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`. El worker devuelve a la interfaz la indicación de encuadre y el contorno aproximado de la boca. Cierra cada `ImageBitmap` transferido tras la inferencia. El hook cierra los bitmaps no transferidos, cancela temporizadores y termina el worker al desactivar la guía, cerrar la cámara o salir de la captura. [Aviso de privacidad publicado con el SDK](https://www.npmjs.com/package/@mediapipe/tasks-vision#privacy-notice)

La prueba en Chromium observa las solicitudes del navegador y del worker, comprueba la CSP, confirma que la cámara manual funciona sin descargar MediaPipe y ejerce el bloqueo de envíos locales y externos. El retrato de prueba es un SVG sintético convertido en un flujo de cámara con `canvas.captureStream()`. El permiso del navegador se solicita al abrir la cámara. El consentimiento de análisis se solicita para cada foto seleccionada, y el almacenamiento conserva su flujo independiente en `/fotografias`.

## Prueba manual en localhost

Ejecutar en PowerShell desde el worktree del incremento.

```powershell
Set-Location -LiteralPath 'C:\Users\USER\DentaIA-mediapipe'
npm.cmd ci
npm.cmd run dev -- --hostname localhost --port 3000
```

1. Abrir `http://localhost:3000/analisis` y pulsar **Comenzar análisis**.
2. En la pestaña Red de las herramientas del navegador, filtrar por `mediapipe`. Pulsar **Tomar fotografía con tu cámara**, conceder el permiso y confirmar que el filtro sigue vacío.
3. Marcar **Usar guía de encuadre**. Esperar la carga y comprobar las solicitudes locales del worker, SDK, WASM y modelo.
4. Probar con un rostro autorizado. Descentrar la boca, inclinar la cabeza, acercarse o alejarse y abrir la boca gradualmente. Apartar el rostro y comprobar que la guía vuelve a buscarlo. El botón de captura sigue disponible.
5. Pulsar **Capturar fotografía** y revisar la vista previa. Pulsar **Tomar otra fotografía** para repetir. Comprobar también **Seleccionar archivo** con una imagen sintética o autorizada.
6. Desactivar la guía y comprobar que la cámara manual sigue disponible. Cerrar la cámara, volver a la preparación o navegar fuera del análisis y comprobar que la cámara se apaga. Detener Next.js con `Ctrl+C`.

La asistencia mide proporciones y depende de que el rostro sea reconocible. Las fotos intraorales de cerca pueden quedar sin guía y se pueden capturar manualmente.

### Validación en dispositivos físicos pendiente

Registrar en DI-244 el dispositivo, versión de sistema y navegador, cámara seleccionada y resultado de cada caso en Safari iOS y Chrome Android.

| Caso | Evidencia esperada |
| --- | --- |
| Permisos y cámara | Conceder, denegar, revocar y volver a conceder. Comprobar cámaras frontal y trasera, espejo y captura manual. |
| Rotación | Cambiar entre vertical y horizontal antes y durante el seguimiento. Verificar la alineación del marco y el contorno, y la orientación del JPEG en vista previa. |
| Rendimiento | Medir el tiempo hasta la primera guía en frío y con caché, y la cadencia de actualización durante una sesión sostenida. |
| Memoria | Medir consumo inicial, pico durante la detección y estado tras tres ciclos de activar, desactivar y cerrar. Registrar método y cualquier reinicio del navegador. |
| Recuperación | Probar regreso desde segundo plano, interrupción de cámara y fallo de descarga al iniciar la guía. Verificar que el reintento funciona y que se conserva la captura manual. |

Queda pendiente la compatibilidad física en ambos sistemas y la revisión de los demás navegadores de escritorio.

## Resultados de la validación inicial

Windows, Node `22.16.0`, Next.js `15.5.29`, TypeScript `5.9.3` y Chromium de Playwright `159.0.8154.6`. PowerShell resolvió `npm.cmd` a `10.9.2`. La instalación y las auditorías npm se repitieron con `11.4.1` desde una copia temporal del CLI. Las pruebas de navegador y la compilación se ejecutaron sobre una copia temporal de los archivos del incremento con configuración sintética y sin `.env.local`. La guarda existente rechaza ese archivo en el worktree original. El servidor de pruebas se detuvo antes de ejecutar build y después typecheck.

| Comprobación | Resultado | Salida |
| --- | --- | --- |
| `npm ci` y `node scripts/preparar-mediapipe.mjs` con npm 11.4.1 instalado temporalmente | 174 paquetes instalados y 4 hashes verificados. | 0 ambos |
| `node scripts/ci/node-tests.mjs unitarias` | El wrapper de Windows falla en `spawnSync npm` con `ENOENT`. | 1 |
| Inventario de unitarias Node ejecutado directamente | 520 casos en 77 archivos. | 0 |
| `npm test` y `npm run test:planes` | 116 casos Vitest y 2 del catálogo. | 0 ambos |
| `node scripts/ci/node-tests.mjs integracion` | 11 casos. | 0 |
| `node scripts/ci/node-tests.mjs contratos` | 16 casos. | 0 |
| `node scripts/ci/node-tests.mjs regresion` | 4 casos de Smile. | 0 |
| `python -m pytest tests -q` en `services/dental-vision` | 4 casos de FastAPI y análisis oral. Los filtros del pipeline de contrato y autenticación pasaron un caso cada uno. | 0 en las tres ejecuciones |
| `node --test e2e/isolation/isolation.test.cjs` | 1 caso de la guarda de red. | 0 |
| `npm run test:e2e` | 17 casos, incluidos 5 de captura guiada con medios sintéticos. | 0 |
| `npm run build` seguido de `npm run typecheck` | Ambos pasaron con localhost detenido. Autoprefixer advirtió sobre estilos de panel, rutinas y solicitudes. | 0 ambos |
| `npm audit`, `npm audit --omit=dev` y `python -m pip_audit -r services/dental-vision/requirements.txt` | Sin vulnerabilidades reportadas. | 0 en las tres ejecuciones |
| Semgrep `1.185.0` con reglas locales del pipeline | 5 reglas, 363 archivos, 0 hallazgos. El ejecutable Windows necesitó acceso al almacén de certificados para arrancar. | 0 |
| `pip check`, Bandit `-ll`, Gitleaks, actionlint y validación YAML de workflows | Pasaron. Gitleaks escaneó los cambios y archivos nuevos junto con el resto de las fuentes, excluyendo archivos de entorno ignorados. | 0 en las cinco ejecuciones |
| `git diff --check` | Pasó en el worktree. | 0 |

Las comprobaciones SQL del pipeline requieren PostgreSQL 17 y quedaron fuera de la ejecución local. La validación del pipeline remoto queda pendiente.

## Cierre de auditoría del 24 de noviembre de 2026

La auditoría independiente reportó **Aprobado con observaciones**, con 0 hallazgos críticos, 0 altos, 1 medio y 3 bajos. La revisión funcional manual en localhost fue satisfactoria según el solicitante.

| Hallazgo | Resolución y evidencia |
| --- | --- |
| M-1 | La URL exacta del cargador WASM JS se comparte entre el interceptor y `wasmLoaderPath`. Playwright verificó los tres GET permitidos con respuesta 200 y tamaños esperados, nueve rechazos por método, ruta u origen, la CSP exacta, y detección y pérdida de seguimiento con el SDK y modelo reales. |
| B-1 | Se documentó el alcance de `transpileModule()`, y `tsc --listFilesOnly` confirmó las dos fuentes incluidas en typecheck. Dos preparaciones sucesivas produjeron los mismos cinco archivos por SHA-256. Los hashes del JS emitido son `48834d03f9d6b76631a611ffd60da96fb3e16a69b271a275bd1fbd7f80af2aa4` para el worker y `0ca8d871637496eb3ec22a635af50cbdb67781cbe13b7e00cf7dc43699bac2c9` para geometría. |
| B-2 | Se documentó la matriz móvil pendiente y se confirmó la subtarea existente [DI-244](https://jhanfranco.atlassian.net/browse/DI-244). |
| B-3 | Una descarga nueva de la generación oficial `1683136941916318` devolvió 3 758 596 bytes y el mismo SHA-256 que el archivo local y la ficha oficial. npm confirmó Apache-2.0 y la integridad del paquete fijado. El modelo sigue como binario en el árbol del incremento. |

### Compatibilidad estática

`git ls-remote --exit-code origin refs/heads/main` devolvió `795baa88bd15bf1701615632c49e75354fa9be03`, la base original. Hay cero commits incorporados desde esa base. El incremento Premium pendiente parte de la misma base. La comparación en solo lectura, incluyendo archivos nuevos, encontró 16 rutas del incremento MediaPipe y 13 de Premium, con intersección vacía.

| Área | Evidencia y estrategia de integración |
| --- | --- |
| Cámara y validación de fotos | MediaPipe usa la cámara, `restriccionesCamara` y los validadores existentes. Premium añade a `fotografia.ts` un tipo MIME derivado de la lista existente, sin cambiarla. Ambas piezas pueden compartir ese archivo base y una sola interfaz de captura. |
| Smile V17 | El frontend conserva las rutas, autenticación y validación de respuestas existentes. La foto se envía solo desde la acción de análisis con consentimiento. El backend, sus contratos y el limitador siguen iguales a la base. Smile pasó su regresión Node y las pruebas FastAPI. |
| Premium Vision | Premium declara un proveedor servidor y un alcance propio de consentimiento. La capacidad sigue deshabilitada. MediaPipe funciona en el cliente antes de cualquier análisis y carece de dependencia de planes, proveedores o lógica de persistencia Premium. |
| Almacenamiento y autorización | `/fotografias`, sus permisos, las migraciones RLS y la autenticación del backend quedaron fuera del diff. La guía descarta fotogramas y landmarks en memoria. El JPEG capturado se mantiene en la preparación local hasta que el usuario decide su uso. |
| Dependencias, Next.js y CI | Premium conserva los manifiestos, Next.js, TypeScript, Playwright y el workflow de la base. La corrección Windows de Premium está en `scripts/ci/node-tests.mjs`, que MediaPipe no modifica. El inventario del wrapper descubre las suites por ruta. La integración mínima conserva la corrección en Premium y ejecuta después el pipeline con ambos cambios. |

La ejecución conjunta con Premium y el pipeline remoto quedan pendientes de autorización de Jhan.

### Verificación del cierre

La copia de ejecución se construyó con todos los archivos de `git ls-files --cached --others --exclude-standard`. Se comparó el SHA-256 de cada uno de los 1 224 archivos antes y después, sin cambios en la copia. El manifiesto SHA-256 fue `b1ab52ce53a26350d04b190494df9f06fcef6f633f69f98173382ad5079d966e`. El único archivo actualizado en el worktree después de la copia fue este documento. Las suites conservaron el inventario y la configuración del repositorio. La copia excluyó los archivos ignorados de entorno y usó las variables sintéticas del arnés para Playwright y build.

| Comprobación | Resultado | Salida |
| --- | --- | --- |
| `npm ci` con npm 11.4.1 y preparación reproducible | 174 paquetes instalados, cinco artefactos idénticos en dos ejecuciones. El runtime del worktree coincide con el de QA. | 0 |
| Wrapper oficial de unitarias | 520 pruebas Node pasaron. Al iniciar npm desde Windows, el wrapper falló con `spawnSync npm ENOENT`. | 1 |
| Unitarias directas con el inventario oficial | Node 520 y Vitest 116. | 0 ambas |
| Integración, contratos, regresión Smile y catálogo de planes | 11, 16, 4 y 2, respectivamente. | 0 en todas |
| Playwright y prueba de la guarda de red | 17 casos de Chromium, incluidos los cinco de captura, y 1 de la guarda. | 0 ambas |
| Backend FastAPI, filtro de contrato y filtro de autenticación | 4, 1 y 1, respectivamente. | 0 en todas |
| Build seguido de typecheck | Ambos pasaron con los puertos locales 3000 y 43117 detenidos. Se confirmaron ambas fuentes con `tsc --listFilesOnly`. El build emitió avisos de Autoprefixer en estilos ajenos al incremento. | 0 en todas |
| Auditorías npm completa y de producción, auditoría Python y `pip check` | Sin vulnerabilidades reportadas y sin conflictos de dependencias Python. | 0 en todas |
| Semgrep, Gitleaks, Bandit `-ll`, actionlint, validación YAML y `git diff --check` | Semgrep aplicó cinco reglas sobre 363 archivos, con cero hallazgos. Gitleaks no encontró secretos. Las demás comprobaciones pasaron con su configuración existente. | 0 en todas |

La guía mantiene la cámara y sus fotogramas en el navegador, sin persistencia ni carga automática. La prueba observó cero solicitudes externas y cero escrituras durante la captura. Los controles de autenticación y autorización, los permisos de galería y las migraciones RLS se conservan según la comparación estática. Los jobs SQL de rutinas y de contactos y citas requieren PostgreSQL 17, que no estaba disponible en el entorno. Las puertas remotas, verificaciones de infraestructura y pruebas físicas de DI-244 quedan pendientes.

**Preparación para commit** lista técnicamente. **Preparación para integración** compatible en revisión estática, pendiente de ejecución conjunta. **Preparación para producción** pendiente del pipeline remoto, de la matriz física y de la autorización de Jhan.
