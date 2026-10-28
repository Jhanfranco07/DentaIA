# Rediseño y demostración educativa de DentaIA

> Este documento conserva la evidencia histórica del PR #13. El recorrido y material vigentes se documentan en [Premium Experience](PREMIUM_EXPERIENCE.md); las ilustraciones antiguas se retiraron y las fotografías clínicas permanecen pendientes de autorización.

Aporte independiente de Jhan Franco sobre `main` (base `6dfe23e`). Se conserva el historial y las implementaciones originales de Angie (directorio), Anelis (solicitudes), Stephan (consentimiento y fotografías) y Jhan (cuenta y recuperación de borrado).

## Recorrido para presentar

1. Inicio → **Crea tu cuenta** o **inicia sesión**. El registro y la confirmación de correo continúan dependiendo de Supabase Auth; no se simulan en la aplicación.
2. **Demostración** (`/analisis/demo`) funciona sin cuenta. Elegir una de las tres ilustraciones originales y pulsar **Iniciar demostración**.
3. Consultar las observaciones educativas y las regiones ilustrativas, cuando correspondan. Pulsar **Ver mi reporte** y **Descargar reporte PDF**.
4. **Consultar profesionales** → perfil ficticio → **Solicitar atención de demostración**. Se conserva el profesional elegido si su ID está entre los profesionales disponibles; la URL no autoriza ninguna operación.
5. Con sesión, completar el formulario y consultar **Mis solicitudes**. El registro, consulta y cancelación siguen utilizando Supabase y sus restricciones existentes; una solicitud no confirma una cita ni contacta a una clínica.
6. Para probar el almacenamiento privado por separado, descargar una muestra, abrir **Mis fotografías**, iniciar sesión, aceptar el consentimiento de almacenamiento y cargarla. Se conservan la visualización, revocación y eliminación reintentable del PR #11. Guardar una fotografía no autoriza procesamiento por IA.

## Tres casos propios y reproducibles

| ID y archivo en `public/demo/` | Resultado preparado | Regiones |
| --- | --- | --- |
| `cuidado-habitual.png` / `.svg` | Sin zonas especiales señaladas en este ejemplo | Ninguna |
| `atencion-preventiva.png` / `.svg` | Zona ilustrativa en una pieza dental, sin diagnóstico confirmado | Una |
| `cuidado-encias.png` / `.svg` | Cuidado educativo de encías, sin detección de enfermedad | Una |

Las ilustraciones se dibujan mediante SVG propio y se convierten a PNG con `sharp`, dependencia transitiva ya fijada por Next.js. No son fotografías clínicas ni proceden de pacientes o bancos externos. `node scripts/generar-muestras-demo.mjs` regenera los archivos, los JPEG pequeños de pruebas y sus hashes en `src/features/analisis/casos.ts`.

La asociación utiliza SHA-256 de los bytes completos. Descargar un PNG y cambiar su nombre conserva su asociación. Cambiar su contenido, recomprimirlo o aportar otra imagen no produce hallazgos simulados. La interfaz explica que el análisis automático de otras imágenes aún no está disponible. Los archivos elegidos permanecen en este navegador y no se envían a una API de análisis.

Los resultados son fijos y llevan **Resultado simulado para fines académicos**. No hay YOLO, inferencia, porcentajes de confianza ni resultados aleatorios. Las regiones son coordenadas preparadas para cada ilustración. El consejo educativo se apoya en las páginas públicas del [NIDCR sobre higiene oral](https://www.nidcr.nih.gov/health-info/oral-hygiene) y [salud de las encías](https://www.nidcr.nih.gov/health-info/gum-disease); no sustituye una consulta.

## Reporte PDF real

`src/features/analisis/pdf.ts` genera un archivo PDF 1.4 con tipografía Helvetica/WinAnsi, imagen JPEG incrustada, regiones dibujadas, fecha de Lima, identificación del caso, observaciones, recomendaciones, aviso y enlace al directorio. La descarga utiliza Canvas y Blob del navegador; no requiere dependencias nuevas, cuentas ni servicios externos. No incluye el nombre, correo ni historial del paciente. No se crea historial persistente.

La función pura `crearPDF()` se prueba con imágenes JPEG de referencia. La descarga completa del navegador se comprueba por separado. La fecha corresponde a la generación; los resultados educativos permanecen fijos.

## Diseño y compatibilidad

Encabezado, marca SVG, navegación móvil con Escape, enlace para saltar al contenido y pie compartidos. Paleta blanca, azul suave y turquesa, tipografía del sistema, foco visible, controles de al menos 44 px y movimiento reducido. Inicio, cuenta, directorio y detalle, solicitudes, fotografías, privacidad y demostración comparten una identidad.

Se corrige la exposición preexistente del mensaje técnico en `DentistaDetalle.tsx`. Los errores de fotografías se traducen para pacientes sin cambiar las decisiones de autorización o borrado. No se modifican los workflows, las dependencias, el cliente Supabase, los esquemas ni las políticas RLS. Se conserva la versión y el texto almacenado del consentimiento existente.

## Verificaciones reproducibles

```powershell
npm ci
npm run typecheck
npm run build
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
npm audit
git diff --check
```

`scripts/qa-recorrido-demo.mjs` exporta `ejecutarRecorrido(browser, baseURL, outDir, repo)` para un navegador Playwright suministrado por el entorno de QA. No añade Playwright al proyecto ni cambia GitHub Actions. Usa una sesión y respuestas Supabase ficticias interceptadas exclusivamente en su contexto aislado; nunca crea usuarios ni escribe en Supabase real. Comprueba navegación, teclado, asociación por contenido, tres descargas PDF, errores, estados vacíos y los flujos existentes de cuenta, fotografías y solicitudes. Las capturas y resultados quedan en `outDir`, fuera del repositorio. Es evidencia de integración de interfaz con un proveedor simulado, no una prueba de RLS real.

La conexión real de solo lectura se verifica aparte: directorio público y restricción de las cuatro tablas privadas como visitante. No equivale a comprobar autenticación, persistencia privada o aislamiento HTTP entre dos JWT.

### Evidencia ejecutada el 27 de octubre de 2026

- `npm ci`: aprobado, 36 paquetes instalados mediante el lockfile. La extracción local en Windows tardó aproximadamente 30 minutos; no se alteraron las dependencias.
- TypeScript y build de producción: aprobados. Las nuevas rutas aparecen en la salida del build.
- Node.js: **74/74 pruebas** aprobadas (60 existentes y 14 adicionales: 11 de muestras, asociación, navegación y PDF; 3 de mensajes de fotografías). La prueba existente de configuración de cuenta ahora exige un mensaje comprensible y ausencia de detalles internos.
- `npm audit`: **0 vulnerabilidades**, en todos los niveles. [Salida JSON](evidencias/rediseno-ui/auditoria.json).
- Navegador Chrome de escritorio en modo headless, con servicios Supabase simulados: **12/12 escenarios** aprobados, sin errores de ejecución. Incluye tamaños 1440, 768 y 390 px, navegación con teclado y capturas privadas de perfil, galería y solicitud. [Resultados completos](evidencias/rediseno-ui/resultado-recorrido.json).
- Descarga real de los tres PDF desde el navegador: aprobada. Validación con pypdf: una página, una imagen incrustada, advertencia, acentos y enlace al directorio en cada caso. Ejemplo renderizado e inspeccionado con Poppler: [reporte](../output/pdf/reporte-demostracion-dentaia.pdf).
- Supabase real, exclusivamente HTTP GET con clave pública: `dentists` HTTP 200, cuatro perfiles ficticios; `profiles`, `appointment_requests`, `patient_consents` y `dental_photos` HTTP 401, código `42501`, sin datos privados. No hubo escrituras reales.
- Navegador aislado contra Supabase real: lista de cuatro profesionales y perfil detallado aprobados, ambas consultas HTTP 200. Se bloquearon las escrituras en ese contexto. [Resultados](evidencias/rediseno-ui/directorio-real.json) y [captura](evidencias/rediseno-ui/directorio-supabase-real.png).
- Se encontró y corrigió durante QA una aserción que esperaba el texto técnico anterior. Los primeros intentos de navegador tuvieron tiempos de compilación y diferencias del arnés simulado; se corrigieron las esperas y la simulación de valores por defecto del servidor. Los resultados enlazados corresponden a la ejecución completa aprobada.

Capturas: [inicio anterior en producción](evidencias/rediseno-ui/antes-inicio.png), [inicio nuevo en escritorio](evidencias/rediseno-ui/despues-inicio-1440.png), [inicio nuevo en móvil](evidencias/rediseno-ui/despues-inicio-390.png), [resultado y reporte](evidencias/rediseno-ui/despues-resultado-reporte.png), [galería privada con proveedor simulado](evidencias/rediseno-ui/despues-galeria-390.png) y [solicitud con proveedor simulado](evidencias/rediseno-ui/despues-solicitud-390.png). Los tamaños móviles corresponden a una ventana de navegador, no a un teléfono físico.

## Límites y evolución

- No hay análisis clínico ni certificación para uso con fotografías reales de pacientes. Utilizar únicamente imágenes sintéticas y cuentas de prueba.
- No se repite un registro por correo, aislamiento HTTP con dos JWT ni expiración real de sesión en esta revisión. No se solicitan contraseñas por chat ni se guardan credenciales.
- Storage y PostgreSQL no comparten una transacción. Si una eliminación queda parcial, se conserva la recuperación por reintento; abandonar el flujo puede requerir retomarlo después.
- La verificación automática de tamaños y teclado no sustituye una auditoría exhaustiva de accesibilidad ni pruebas manuales en dispositivos físicos.
- Para incorporar IA real se necesitará una integración de servidor independiente: consentimiento específico de procesamiento, validación de sesión y propiedad, política de retención, modelo evaluado y resultados trazables. El catálogo `CASOS` es una fuente demostrativa separada; no debe presentarse como salida de ese modelo ni reutilizarse como respaldo ante errores de inferencia.
- La producción y Jira no se modifican en este PR. El despliegue de esta rama es una vista previa; su integración requiere revisión y autorización posterior.
