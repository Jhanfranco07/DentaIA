# Estabilización local de `develop`

Fecha de validación: 2026-11-05
Rama: `develop`
SHA base probado: `0b554d1292614f6a93bf4ab29591c00a2c68c035`
Estado de publicación: validaciones locales repetidas antes de publicar la estabilización autorizada; SHA de publicación en el historial de `develop`.

## Diagnóstico y ajustes

`/cuenta` validaba la sesión, pero nunca resolvía su módulo: mostraba siempre el perfil de paciente y no ofrecía un enlace visible a `/profesional`. Las páginas del panel de paciente y del odontólogo tampoco consultaban el rol antes de montar sus vistas. El rol ahora se deriva exclusivamente de `app_metadata.dentaia` entregado por `auth.getUser()`. `user_metadata`, datos del formulario, parámetros de URL y el rol técnico de Postgres no conceden módulos.

Después de iniciar sesión, la aplicación navega al módulo por defecto del rol verificado. Para cuentas con más de un rol se aplica una prioridad de navegación explícita: superusuario → odontólogo → paciente. Esta prioridad solo elige una ruta; no hereda permisos. Cada módulo y API vuelve a aplicar sus propias restricciones. `/panel`, `/fotografias` y `/solicitudes` requieren el rol paciente; `/profesional` requiere odontólogo. Una asignación de URL no cambia esta decisión.

La página DI-144 existente solo se exponía bajo `NODE_ENV=development`. Se agregó `/administracion`, que solo se habilita en desarrollo local o con `DENTAIA_ADMIN_PREVIEW_ENABLED=true` en Vercel Preview de la rama exacta `develop`. La vista conserva el guard existente de Auth, rol superusuario y AAL2. La lectura privilegiada de cuentas tiene además una restricción de entorno local/Preview de `develop`; el feature flag por sí solo no permite Production. Los cambios de roles se bloquean en cualquier despliegue de Vercel, incluso si su bandera se activa accidentalmente.

El BFF clínico estaba fijado a `feature/preview-clinical-backend`; ahora reconoce únicamente `develop`, con los opt-ins, host/origen Vercel, proyecto Supabase, allowlist, JWT, roles, membresía, consentimiento, RPC con JWT del usuario, RLS y auditoría ya existentes. No se agregó clave privilegiada al BFF.

## Rutas

- Visitante: `/` y las páginas comerciales públicas; registro e inicio en `/cuenta`.
- Paciente: `/panel`; fotografías y solicitudes bajo `/fotografias` y `/solicitudes`.
- Odontólogo: `/profesional`.
- Superadministrador: `/administracion`, solo tras autorización de servidor con rol y AAL2.

El registro público no asigna roles mediante `user_metadata`, conforme a la matriz existente. Una cuenta nueva sin una asignación activa de `app_metadata.dentaia` permanece sin acceso al panel hasta que exista un aprovisionamiento autorizado de rol; no se implementó autoasignación.

## Validaciones locales

Ejecutadas en el worktree `DentaIA-develop`, sin credenciales QA:

| Validación | Resultado |
|---|---|
| `npm run typecheck` | Aprobada |
| `npm run build` | Aprobada; incluyó `/administracion` y las rutas existentes |
| `$testFiles = rg --files src -g '*.test.mjs'; node --experimental-strip-types --test @testFiles` | 401 aprobadas, 0 fallidas |
| Pruebas específicas de roles, navegación por módulos, entorno admin y Preview BFF | 35 aprobadas en la primera ejecución enfocada; incluidas también en la suite de 401 |
| `git diff --check` | Aprobada; sin whitespace errors |

La suite usa dobles/fixtures para las comprobaciones de roles y servicios. No equivale a inicio de sesión real, RLS ni auditoría persistente en Supabase.

## Verificaciones reales y pendientes

No hay deployment Vercel asociado a la rama `develop`; por tanto, no se pudo validar esta versión mediante navegador ni HTTP en Preview. Esta publicación no cambia Vercel ni inicia un despliegue manual.

El archivo de cuentas QA está presente en otro worktree local y sus cuatro variables de contraseña no están vacías; aquí no se imprimieron ni se copiaron. El informe previo `DI145_LOCAL.md` registra que Paciente B inició sesión y mostró el rol esperado, mientras que Paciente A, Odontólogo A y Odontólogo B fallaron su autenticación. No repetí esos intentos para evitar nuevos fallos de contraseña. La cuenta superadministradora no estaba configurada en ese almacén de cuatro cuentas. Quedan pendientes los recorridos reales de los módulos, permisos, consentimiento, logout y auditoría.

No se ejecutó `check:supabase`: su script consulta `profiles`, solicitudes, consentimientos y fotos privadas con `select("*").limit(1)`. Sin una garantía adicional de dataset exclusivamente sintético, esa comprobación podría devolver contenido real; por eso no se ejecutó.

El flujo MFA/AAL2 está conservado y bloquea correctamente el panel si el servidor no confirma AAL2. La ruta de preparación MFA existente es solo local; no se comprobó un desafío MFA en Preview. Para acceder desde Preview, la cuenta debe tener un factor configurado y una sesión AAL2 válida; si no, falta validar un recorrido de step-up autorizado.

## Configuración de Vercel observada y cambios requeridos

La inspección remota fue solo de lectura y no expuso valores. Vercel no tiene variables con alcance específico a la rama `develop`. Las diez variables del BFF aparecen con alcance global a `Preview` y `Production`:

`DENTAIA_CLINICAL_PREVIEW_ENABLED`, `DENTAIA_CLINICAL_HTTP_ENABLED`, `DENTAIA_CLINICAL_TARGET`, `DENTAIA_CLINICAL_ACADEMIC_ENABLED`, `DENTAIA_CLINICAL_PROJECT_REF`, `DENTAIA_CLINICAL_SUPABASE_URL`, `DENTAIA_CLINICAL_SUPABASE_PUBLISHABLE_KEY`, `DENTAIA_CLINICAL_DEMO_USER_IDS`, `DENTAIA_CLINICAL_CURSOR_SECRET` y `DENTAIA_CLINICAL_CURSOR_TTL_SECONDS`.

Antes de desplegar `develop`, revisar y limitar esas diez variables a `Preview` + rama `develop`, retirando el alcance `Production`. Asignar a `DENTAIA_CLINICAL_CURSOR_SECRET` un valor independiente para `develop`; la configuración actual no es branch-scoped, por lo que no demuestra separación del secreto usado por otras ramas. `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ya existen; no se deben duplicar.

Agregar `DENTAIA_ADMIN_PREVIEW_ENABLED` únicamente en `Preview` + rama `develop` para habilitar la ruta `/administracion`. Esta variable no existe en la configuración observada. Las lecturas reales del listado administrativo siguen deshabilitadas: el panel no dispone de `DENTAIA_ADMIN_READS_ENABLED` ni de `DENTAIA_SUPABASE_ADMIN_READ_SECRET`. No se recomienda agregar una clave administrativa a Vercel hasta revisar el alcance y la necesidad de esa función. `DENTAIA_ROLE_WRITES_ENABLED` no está configurada y, además, el código ahora bloquea escrituras en Vercel.

El BFF usa `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF` y `VERCEL_URL` desde el servidor. La documentación oficial indica que estas variables de sistema están disponibles en build y runtime cuando está habilitada la exposición automática de variables de sistema ([Vercel: System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)). El host se valida contra `VERCEL_URL` de la propia petición, sin construir una URL externa ni depender de una allowlist previamente obtenida del deployment. No se pudo comprobar el valor de configuración de exposición del proyecto ni el comportamiento en runtime porque no hay deployment `develop`; debe verificarse al preparar el Preview.

No se modificaron variables de Vercel, proyecto Supabase, usuarios, datos, políticas, migraciones ni Jira.

Los archivos locales `.env*` están cubiertos por `.gitignore`; `.env.example` es el único archivo `.env*` rastreado. Los archivos de credenciales permanecen en otro worktree ignorado y no aparecen en los cambios de `develop`.

## Archivos locales modificados

- Navegación y guards: `src/features/cuenta/Cuenta.tsx`, `src/features/cuenta/useSesion.ts`, `src/features/autorizacion/roles.ts`, `src/features/autorizacion/AccesoRol.tsx` y sus pruebas.
- Rutas: páginas de panel, profesional, fotografías y solicitudes; nueva `src/app/administracion/page.tsx`.
- Límites administrativos: `src/features/administracion/entorno-panel.ts`, `lecturas-supabase.ts`, `servidor-cambios-roles.ts` y pruebas.
- BFF: `src/features/clinica-http/ambiente.ts` y `ambiente.test.mjs`.
- Este informe.

Las comprobaciones de TypeScript, build, pruebas automatizadas y diff limpio se repitieron antes de publicar esta estabilización. Este informe no incluye credenciales ni valores de variables privadas.
