# Habilitación del BFF clínico en Vercel Preview

Fecha: 05/11/2026. Rama: `feature/preview-clinical-backend`. PR Draft: #27 hacia `integration/sprint5-demo`.

## Cambios y controles

El BFF remoto estaba limitado a `NODE_ENV=development`, entorno sin variables `VERCEL`, y orígenes locales HTTP. La configuración académica también requería `NODE_ENV=development`; por eso Vercel Preview no podía activarla.

El cambio permite únicamente Preview (`VERCEL=1`, `VERCEL_ENV=preview`) en la rama `feature/preview-clinical-backend`, con `DENTAIA_CLINICAL_PREVIEW_ENABLED=true`. El host esperado no se deriva de `Origin` ni de `Host`: Vercel asigna `VERCEL_URL` como nombre de host sin esquema y el BFF compara la URL de la solicitud con `https://${VERCEL_URL}`. También exige `Origin`, si viene presente, igual a ese origen y rechaza `Sec-Fetch-Site: cross-site`. La rama viene de `VERCEL_GIT_COMMIT_REF`. Sin esas variables de sistema, flags o coincidencias, el BFF queda cerrado.

Vercel documenta que `VERCEL_URL` y `VERCEL_GIT_COMMIT_REF` son variables de sistema disponibles en build/runtime si se habilita el acceso a variables de sistema. La validación del BFF solo compara el host de la solicitud con `VERCEL_URL`; no hace una llamada de red al host derivado. La política de Deployment Protection del proyecto no se pudo comprobar y debe confirmarse antes de dar el Preview por habilitado. Referencias: [variables de sistema de Vercel](https://vercel.com/docs/environment-variables/system-environment-variables), [protección de deployments](https://vercel.com/docs/deployment-protection).

Se conservan el SDK público de Supabase, verificación `getClaims`/`getUser`, allowlist académica y marcador de dataset, validación de asignación de roles, RPC con JWT del usuario, límites de origen y registro/auditoría. No se añade clave `service_role`, no se cambian RLS, datos ni migraciones.

## Variables requeridas

Todas las variables definidas por el proyecto deben configurarse solo como Preview con alcance a la rama `feature/preview-clinical-backend`:

- `DENTAIA_CLINICAL_PREVIEW_ENABLED`
- `DENTAIA_CLINICAL_HTTP_ENABLED`
- `DENTAIA_CLINICAL_TARGET`
- `DENTAIA_CLINICAL_ACADEMIC_ENABLED`
- `DENTAIA_CLINICAL_PROJECT_REF`
- `DENTAIA_CLINICAL_SUPABASE_URL`
- `DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY`
- `DENTAIA_CLINICAL_DEMO_USER_IDS`
- `DENTAIA_CLINICAL_CURSOR_SECRET` — tipo Secret, generado aleatoriamente y exclusivo de este Preview.
- `DENTAIA_CLINICAL_CURSOR_TTL_SECONDS`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Las variables `NEXT_PUBLIC_*` son públicas; las demás son de servidor. La allowlist no es una credencial. No deben configurarse contraseñas de cuentas QA ni claves privilegiadas. El proyecto debe exponer variables de sistema para que el BFF reciba `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF` y `VERCEL_URL`. Referencias: [variables de entorno de Preview](https://vercel.com/docs/environment-variables).

## Pruebas

### Aprobadas localmente

- `npm run typecheck`.
- `npm run build` con Next.js 15.5.28.
- `node --experimental-strip-types --test`: 392 aprobadas, 0 fallidas, 0 omitidas. Incluye pruebas positivas de configuración de Preview y negativas por producción, rama/opt-in incorrectos, proyecto, origen cruzado, host inválido, token/claves y allowlist.
- `npm run test:profesional`: 65 aprobadas.
- Pruebas de `src/features/clinica-http/*.test.mjs`: 61 aprobadas.
- `git diff --check`.

Estas son pruebas locales automatizadas, no verifican Supabase remoto ni el runtime de Vercel.

### Bloqueadas o pendientes

- No se configuraron variables en Vercel ni se generó el secreto de cursor porque la conexión Vercel disponible no tiene acceso al proyecto `dent-ai`: solo lista `warmi-digital` y la lectura de `dent-ai` devuelve 404. No se intentó usar credenciales o un contexto alternativo.
- El check `Vercel` de GitHub para el SHA `f91a445816a77bd0fb30a02db6adf7b068002c55` figura `success` (target de check: `https://vercel.com/jhan-francos-projects/dent-ai/5fjg5XwCSRwtJGK5nBomZDPgBeKu`). Sin embargo, la API de Vercel bajo el acceso conectado devuelve 404 para el proyecto `dent-ai` y el deployment, y la lista de deployments de esa rama aparece vacía. Por ello no se pudo verificar independientemente el estado `READY`, obtener una URL de Preview ni revisar la configuración efectiva de variables.
- No se verificó la configuración de variables ni Deployment Protection del proyecto.
- No se ejecutaron pruebas HTTP contra Preview, login real ni E2E con cuentas QA. Tampoco hubo escrituras en Supabase.

Para terminar, un administrador con acceso al proyecto `dent-ai` debe habilitar las variables de sistema y configurar la lista anterior en Preview, solo para la rama indicada. Luego debe confirmar que el deployment del SHA publicado está `READY`, revisar el alcance de variables sin revelar valores, ejecutar respuestas HTTP 401/403/404 esperadas sin sesión/rol/autorización y probar el flujo autenticado con cuentas QA si se proporciona un mecanismo seguro.
