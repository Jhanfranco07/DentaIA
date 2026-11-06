# Optimización de experiencia del producto integrado

## Auditoría y alcance

Base inspeccionada: `main` **5715c90501aa86af13cbf1904cd56e6a4c1838f2**, merge de PR #28. `develop` **7c0244fa247eb5f020156b71d42bddaed7a6d524** tiene el mismo árbol: no faltaban cambios funcionales de main en esa integración. Rama propia: `refactor/ux-experiencia-integrada`. Se conserva la autoría y el historial del equipo.

Se inspeccionaron App Router y sus grupos público/paciente/odontólogo/administración/desarrollo, Supabase Auth, roles, componentes compartidos, CSS Modules, servicios administrativos/clínicos, preparación de fotografías y pruebas/workflows. No hay AGENTS.md en el workspace. Stack vigente: Next 15.5.28, React 19.1.8, TypeScript 5.9.3, Supabase JS 2.118.0 y MapLibre 6.16.0. Se reutiliza este stack sin instalar dependencias en el proyecto.

Problemas encontrados y plan priorizado aplicado:

1. **Landing:** fotografía detrás de una capa de carrusel y tarjetas; enlaces `#` que mostraban vistas privadas de estado React en vez del directorio/privacidad reales; cuatro profesionales y precios ficticios duplicados. Retirar esas vistas de presentación y dirigir a los módulos existentes. Conservar la fotografía y las limitaciones materiales.
2. **Navegación:** variantes distintas del menú de paciente entre cuenta y panel; enlaces profesionales con fragmentos sin selección activa; menú móvil sin contención completa del foco. Compartir configuración, resolver anclas y controlar teclado/fondo.
3. **Cuenta/panel:** cuadrícula de accesos que repetía la barra lateral; acceso redundante a Mi cuenta y varias acciones iguales en el resumen. Priorizar perfil y actividad; mantener cambios de contexto para cuentas multirrol y salida para cuentas sin rol.
4. **Módulos:** mejorar lectura y controles de paciente, odontólogo y administrador sin sustituir servicios, formularios o gestores. El directorio vacío no debe inventar una tarjeta de clínica DEMO.
5. **IA y privacidad:** explicar la preparación local disponible y el análisis aún no disponible, conservar avisos clínicos y de datos sintéticos; retirar información obsoleta sobre reportes de una demostración ya retirada de las rutas públicas.

## Cambios implementados

- Landing renderizado en servidor con `next/image` y una fotografía existente optimizada, sin carrusel/capas que la oculten. Hero, beneficios por público, pasos, privacidad, alcance IA y CTA con rutas reales. No se añaden estadísticas, testimonios, profesionales ni resultados inventados. El componente histórico del carrusel se conserva, sin utilizarlo en el hero.
- Encabezado público con entrada al espacio según sesión/rol; navegación existente y cierre con Escape conservados. Footer profesional con aviso material de IA y perfiles de ejemplo.
- Configuración de navegación común (`navegacion-portal.ts`) para cuenta y layouts. El perfil deja de duplicar el dashboard; las cuentas multirrol conservan accesos contextuales a sus otros espacios. Las cuentas sin rol conservan cierre de sesión.
- Menú de portal móvil con foco contenido, fondo inerte, bloqueo temporal del scroll, Escape y devolución de foco. Barra lateral desplazable para ventanas bajas. Una sola sección activa al navegar por anclas profesionales.
- Paciente: dos acciones frecuentes en lugar de repetir todas las secciones; tres métricas reales de actividad, sin tarjeta de resultados inexistentes. Historial/consentimientos/solicitudes permanecen en sus módulos y servicios.
- Odontólogo: navegación compartida, anclas visibles bajo la cabecera, campos y controles legibles. **No se altera ProfesionalClinico ni su lógica de datos, permisos o cancelación de consultas.**
- Administración: dos acciones frecuentes en inicio, manteniendo todas las secciones en el menú; tablas, campos y botones más legibles; textos operativos sin referencias a tickets. Gestores de usuarios, roles, consultorios, vinculaciones y reseñas conservados. Ningún cambio en guards, MFA/AAL2, APIs o SQL.
- Directorio: avisos precisos de perfiles ficticios, recuperación de errores conservada y estado vacío sin una tarjeta DEMO artificial cuando no existen ubicaciones de ejemplo publicadas.
- IA: únicamente texto/presentación de los componentes existentes. El botón que solo informa de la indisponibilidad ahora dice «Consultar disponibilidad de IA». Se conserva el flujo de cámara, selección, validación y revisión local. No se modifican modelos, contratos, endpoints, inferencia, entrenamiento ni consentimiento almacenado.
- Se mantiene el texto/versionado del consentimiento de fotografías: cambiar términos guardados excedería una mejora de presentación. Se conservan también las etiquetas necesarias en vistas explícitas de datos sintéticos.

## Verificación y reproducción

Usar Node **22.23.4** (instalado fuera del repositorio para QA), dependencias del lockfile, Python con Playwright **1.62.0** y Chromium **154.0.8037.57** ya disponibles. No se añade Playwright al package.json.

```bash
npm ci --ignore-scripts
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
npm run build
npm run typecheck
npm audit --json
git diff --check
```

Build y typecheck se ejecutaron secuencialmente, con servidor de desarrollo detenido. Para reproducir navegador con fixtures, iniciar en otra terminal (puerto libre 3180):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ux-fixtures.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture \
DENTAIA_ADMIN_READS_ENABLED=false DENTAIA_ROLE_WRITES_ENABLED=false \
DENTAIA_CLINICAL_HTTP_ENABLED=false DENTAIA_SUPABASE_ADMIN_READ_SECRET= \
DENTAIA_SUPABASE_ROLE_WRITE_SECRET= \
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3180
```

```bash
python3 scripts/qa-ux.py --output /tmp/dentaia-ux-browser
```

El arnés bloquea tráfico externo e intercepta Auth/API con datos inequívocamente sintéticos. No modifica `.env`, no crea cuentas ni escribe registros. Comprueba 320/390/768/1024/1440 px, hero sin obstáculos, teclado, rutas, estados vacíos/error, perfil, multirrol, permisos de interfaz, preparación local de PNG sintético y listado administrativo. Las capturas usan exclusivamente identidad y datos de fixture.

Para verificar denegaciones reales del servidor, detener dev; realizar build con las mismas variables públicas de fixture y banderas apagadas; iniciar `next start` en 3180 con ellas y ejecutar:

```bash
python3 scripts/qa-ux-http.py --output /tmp/dentaia-ux-http.json
```

Esta batería no intercepta HTTP: llama al servidor Next de producción local sin bearer o con un esquema Basic inválido. No necesita contactar Supabase y no prueba accesos positivos remotos.

Resultados finales: **451 pruebas Node aprobadas (0 fallidas/omitidas), 76 comprobaciones de navegador aprobadas, 14 comprobaciones HTTP aprobadas, TypeScript/build exit 0 y npm audit con 0 vulnerabilidades**. Ver [manifiesto](evidencias/MANIFIESTO.json), [Node](evidencias/NODE22.tap), [navegador](evidencias/NAVEGADOR_FIXTURES.json), [HTTP](evidencias/HTTP_PRODUCCION_LOCAL.json), [build](evidencias/BUILD.txt) y [TypeScript](evidencias/TYPECHECK.txt). Además se comprobó puntualmente el directorio vacío sin tarjeta DEMO a 320 px. Los resultados y la fecha real se conservan en `evidencias/`. No sumar baterías superpuestas como casos únicos. La suite Node contiene pruebas unitarias e integraciones aisladas cliente/BFF/RPC con dobles; no son integración con una base remota.

### Incidencias durante QA

Se conservan los intentos del navegador anteriores en `evidencias/INTENTOS_NAVEGADOR.json`. El primer recorrido tuvo 67/71 aprobados: se ajustó la altura mínima de la fotografía a 320 px; el selector del menú cambiaba al abrirlo, el fixture de error tenía reintentos del SDK y el selector de cierre no distinguía sus dos ubicaciones. Segundo: 71/72, por no inyectar la sesión sintética sin roles. Posterior: 74/74. La revisión de capturas detectó además que la respuesta profesional del fixture omitía `requestId`; se corrigió el fixture y se añadió una aserción positiva de membresía. También se amplió validación del formulario de perfil.

Un intento adicional del recorrido completo contra `next start` se detuvo al llegar a administración con 404: es el cierre previsto de `entorno-panel.ts`, no un fallo de autorización ni un motivo para habilitar la ruta. El recorrido completo administrativo se valida en desarrollo; ese intento incompleto no se registra como suite aprobada. Se conserva el log de ese intento. El primer sondeo HTTP esperaba equivocadamente 401 para GET de ubicaciones, cuyo método soportado es POST; GET devuelve correctamente 405 y POST sin sesión devuelve 401. Se ajustó únicamente el arnés.

Durante revisión se comprobó expresamente la alternativa de cierre para cuentas sin rol y la accesibilidad de las áreas multirrol después de retirar accesos redundantes. Se corrigió contraste del footer y del encabezado administrativo. No se modificaron controles de seguridad para conseguir resultados de QA.

## Restricciones y límites

- Sin cambios en APIs, autorización, RLS, funciones/migraciones SQL, base de datos, credenciales, modelos o pipelines de IA; ninguna operación remota Supabase.
- `/administracion` mantiene el alcance actual: desarrollo local o Preview expresamente autorizado de `develop`; producción y otras ramas permanecen cerradas. El PR de UX no cambia esa política ni activa lecturas/escrituras.
- No se ejecutan scripts de integración remota que requieren el almacén privado DPAPI de las cuentas académicas. No hay identidades de prueba autorizadas disponibles en este entorno cloud. No se afirma login/MFA, RLS, persistencia, cámara física ni inferencia remotos probados en esta entrega.
- ESLint independiente no está configurado: sin script/dependencia/configuración en el repositorio. El mensaje de Next durante build no se presenta como una ejecución independiente de ESLint. No se instala otra herramienta para atribuirle resultados.
- Los flujos remotos y el motor de IA conservan sus dependencias existentes. Las mejoras de presentación no completan esas funcionalidades ni certifican uso clínico.
- Los estilos fueron inspeccionados visualmente en capturas y con teclado; no se declara certificación WCAG o auditoría automática completa de contraste.

## Publicación

Un commit de UX propio, preservando la integración y los autores originales. PR hacia `main`; merge commit normal únicamente tras checks aprobados y ausencia de conflictos, sin force push ni omitir protecciones. El hash final, enlace del PR y estado real del despliegue se entregan después de publicar; este documento no contiene un hash autorreferencial. No se modifican Jira ni configuración de Vercel.
