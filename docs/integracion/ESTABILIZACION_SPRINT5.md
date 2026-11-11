# Estabilización funcional del Sprint 5

Fecha de validación: 2026-11-05 (America/Lima)
Rama: `develop`
SHA evaluado: `83fb0a3` (cambios locales; no publicado)
SHA base de esta intervención: `f6983981b2fbd4bfa2a27e6e79671ef43d13cfd3`

## Cambios implementados

### Servicios clínicos y administrativos

- El cliente administrativo traduce los códigos controlados de autorización del servidor a mensajes en español, sin mostrar detalles privados.
- Los errores de configuración y autorización del BFF clínico quedan distinguidos mediante códigos seguros y estados HTTP; las respuestas al navegador no incluyen secretos, tokens, correos ni identificadores clínicos.
- Se añadieron y ajustaron pruebas unitarias de autorización, cliente administrativo y cliente HTTP clínico.
- Se conservaron las validaciones existentes de sesión, rol, AAL2, allowlist, JWT, consentimiento y RLS. Este cambio no habilita escrituras administrativas bloqueadas.

### Experiencias y navegación

- Se organizaron las rutas con grupos de layout de Next.js, manteniendo sus URL: área pública, paciente, odontólogo, administración y herramientas de desarrollo.
- Los portales de paciente y odontólogo tienen navegación contextual, enlaces activos, menú adaptable, acceso a cuenta y cierre de sesión local.
- El panel administrativo conserva su navegación existente y agrega acceso a cuenta y cierre de sesión local.
- Los enlaces del área profesional dirigen a secciones ya presentes del módulo. No se agregaron módulos de negocio simulados.
- Se corrigió el espacio del menú móvil en pantallas estrechas.
- Se preservaron las rutas y componentes comerciales existentes de la landing.

## Validaciones ejecutadas

- TypeScript: `npm run typecheck` — aprobado.
- Build: `npm run build` — aprobado; compilación, validación de tipos y generación de rutas completadas.
- Suite completa: `$archivosPrueba = rg --files src -g '*.test.mjs'; node --experimental-strip-types --test $archivosPrueba` — 402 aprobadas, 0 fallidas, 0 omitidas.
- Integración HTTP local en build de producción: `/`, `/cuenta`, `/directorio`, `/analisis/demo`, `/panel`, `/fotografias`, `/solicitudes` y `/profesional` respondieron HTTP 200.
- `/administracion` y `/desarrollo/acceso` respondieron 404 en `next start` con entorno de producción local. Es el comportamiento previsto por las restricciones de Preview/desarrollo del código; no cuenta como prueba de acceso administrativo autenticado.
- `git diff --check` — aprobado.

Las pruebas automatizadas utilizan fixtures y dobles según cada prueba. Las 402 aprobaciones no equivalen a E2E contra servicios reales.

## Pendiente: E2E real y Preview

No se ejecutaron inicios de sesión reales, recorridos autenticados de navegador ni consultas E2E contra Supabase Dental-IA o Vercel Preview. La protección de Vercel Preview requiere SSO y no se usó ninguna vía para eludirla. Por tanto, quedan pendientes la verificación de roles y permisos reales, acceso clínico autorizado/denegado, auditoría persistente y recorrido de los cuatro módulos en Preview. No se efectuaron escrituras remotas ni se modificaron Supabase, Vercel o Jira.

El panel clínico solo puede mostrar datos autorizados cuando la configuración Preview y las relaciones sintéticas existentes permiten responder al BFF; la compilación local no prueba esas condiciones remotas. El panel administrativo también depende de la sesión y del nivel AAL2 reales; la lectura administrativa debe comprobarse en Preview, mientras los cambios de roles continúan bloqueados según la configuración existente.

## Límite de autorización de páginas

`AccesoRol` protege la vista en el cliente. Los endpoints que entregan datos protegidos sí realizan sus verificaciones del lado servidor y las consultas conservan RLS. Sin embargo, el cliente actual persiste la sesión de Supabase en `localStorage`, inaccesible para los layouts del servidor en una solicitud de página. En consecuencia, no se implementó ni se afirma un redirect/guard de página autenticado en servidor. Para cumplir ese criterio hace falta migrar la persistencia de sesión a cookies mediante la integración SSR oficial de Supabase y probar renovación, cierre de sesión y rechazo de sesión expirada; no debe sustituirse por cookies de sesión inventadas ni por un guard basado en datos del cliente.

## Commits locales

- `8a76c20` — `fix: distinguir errores sin exponer datos sensibles`
- `c3a18eb` — `refactor: separar portales y navegación por rol`
- `83fb0a3` — `style: adaptar navegación privada a móviles`
- Este informe se registra en un commit documental independiente.

No se realizaron push, despliegues, cambios remotos ni modificaciones de ramas distintas de `develop`.
