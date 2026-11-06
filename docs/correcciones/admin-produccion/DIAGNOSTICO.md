# Administración: 404 deliberado en Production

## Causa comprobada

La base revisada es `main` **f2a7116f524ad1d4cc35a658c141a5b269294716**, que Vercel tiene desplegada en Production (`dpl_GDjkjQbgiMW3MbfkrA97BbQBwR55`, READY, alias `dent-ai-five.vercel.app`). El Preview indicado corresponde a `develop`, commit **e534c1b4f41f61a00cb11afe8983d18b9aadd413**, deployment `dpl_EQQ9SZXf2xiLwD8QUk3BgFNYErAE`. El head actual de develop es **7c0244fa247eb5f020156b71d42bddaed7a6d524**, ya integrado en main por PR #28; main añade las mejoras de UX de PR #30. No faltan commits administrativos ni se requiere reconstruir módulos del equipo.

El destino del login de superusuario (`rutaPrincipalPorRoles`) y el enlace de su cuenta (`NAVEGACION_ADMIN`) son **`/administracion`**. Existe `src/app/(administracion)/administracion/page.tsx`; los grupos entre paréntesis no forman parte de la URL. No se usa `/admin` ni `/dashboard/admin`. No hay middleware en el repositorio; el layout administrativo no redirige y next.config.ts no contiene rewrites/redirects que expliquen el error.

La página ejecuta `notFound()` **antes de importar los componentes y de comprobar Auth** cuando `panelAdministrativoDisponible(process.env)` devuelve false. La política original solo admitía desarrollo local o Preview de develop con `DENTAIA_ADMIN_PREVIEW_ENABLED=true`. Production quedaba excluida incondicionalmente, incluso con login, rol y AAL2 correctos. El 404 no se origina en una ruta ausente ni demuestra un rechazo de Supabase. Los guards de API rechazan con 401/403/503, no con este notFound.

El lector de usuarios tenía además una copia interna de la misma exclusión. Corregir solo la página dejaría la consulta privilegiada inaccesible aunque el operador aprovisionase su configuración.

## Corrección acotada

Rama propia desde main: `fix/admin-acceso-produccion`.

- `entorno-panel.ts`: añade Vercel Production de **main**, con `NODE_ENV=production`, a la disponibilidad de la ruta. Conserva desarrollo local y el opt-in del Preview develop. Otros previews, ramas o entornos incompletos continúan denegados. Esta función decide disponibilidad, no autorización de identidad.
- `lecturas-supabase.ts`: reutiliza `lecturasAdministrativasDisponibles` y elimina la política duplicada. En Production main, la lectura sigue exigiendo exactamente `DENTAIA_ADMIN_READS_ENABLED=true`, credencial privada dedicada, HTTPS, puerto GET acotado, guard de superusuario/AAL2 y respuestas privadas. No hay fallback a otra clave, datos sintéticos o usuario conocido.
- Dos archivos de pruebas ampliados: regresión de destino de cuenta/política de Production, denegación de otros entornos, opt-in y lectura con SDK real/fetch interceptado. El cliente privilegiado sigue siendo server-only.
- `scripts/qa-admin-produccion.py`: regresión del recorrido real de componentes `/cuenta → Panel administrativo` contra el build local en contexto Production/main, usando Auth y API sintéticos.

No se modifican página/layout/menú, autenticación, app_metadata, AAL2, middleware, APIs, SQL, RLS, dependencias, interfaces clínicas ni configuración remota. No se añade una redirección. Las escrituras de roles conservan su cierre duro en Vercel. Ubicaciones y workflows de membresías/reseñas conservan sus restricciones actuales de entorno, incluso si se configura una bandera por error.

## Pruebas ejecutadas

| Batería | Resultado | Alcance |
| --- | --- | --- |
| Regresión antes de la corrección | Reproduce el fallo de Production | Ver `REGRESION_ANTES.tap`; no se cuenta como aprobado. |
| Suite Node 22.23.4 | **454 aprobadas, 0 fallidas, 0 omitidas** | 451 existentes y 3 nuevas; sin red/credenciales. Incluye denegaciones de roles/MFA y escrituras bloqueadas existentes. |
| Next build | Exit 0 | Build local con Vercel Production/main simulado. |
| TypeScript tras build | Exit 0 | Sin ejecutar concurrentemente con build. |
| HTTP real del build local | **7 aprobadas, 0 fallidas** | Administración/cuenta 200; APIs sin sesión 401/no-store; herramientas de desarrollo 404. Sin contactar Supabase. |
| Chromium, build local | **8 aprobadas, 0 fallidas** | Login sintético, selección del enlace desde cuenta, montaje del panel, consulta/búsqueda sintética, cinco tamaños, denegación paciente/odontólogo/superusuario sin AAL2 y ausencia de escrituras/errores JS. |
| Diff | Sin errores | `git diff --check`, incluida revisión del staging. |
| ESLint independiente | No ejecutado | No hay script, configuración o dependencia de ESLint; el mensaje del build no acredita ESLint independiente. |

Se utilizó Node 22.23.4, Playwright Python y Chromium instalados previamente, sin añadir dependencias al proyecto. Las salidas, la fecha real del navegador, captura sintética y hashes están junto a este documento. Los logs solo normalizan retornos de carro/espacios finales. No sumar estas baterías como casos únicos.

Primer intento del navegador: 4 aprobadas/4 fallidas. El login del fixture creaba una sesión y mostraba la cuenta, pero el arnés esperaba una redirección automática que no se produjo; esa expectativa también impedía probar los tres accesos denegados. Se ajustó el recorrido al problema reportado: confirmar la sesión visible en cuenta, seleccionar Administración y verificar la ruta/panel. Se conservan los rechazos y aserciones de privacidad. La redirección automática tras login no queda acreditada por este fixture; no se modifica ni declara corregido ese comportamiento en este PR. Ver `NAVEGADOR_PRIMER_INTENTO.json` y `NAVEGADOR.json`.

Comandos ejecutados, con Node 22 en PATH:

```bash
node --experimental-strip-types --test --test-reporter=tap "src/features/**/*.test.mjs"
# Build y servidor local con estas variables de QA (no son configuración remota):
export VERCEL=1 VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main
export NEXT_PUBLIC_SUPABASE_URL=https://admin404-fixtures.supabase.co
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture
export DENTAIA_ADMIN_READS_ENABLED=false DENTAIA_ROLE_WRITES_ENABLED=false
export DENTAIA_SUPABASE_ADMIN_READ_SECRET= DENTAIA_SUPABASE_ROLE_WRITE_SECRET=
npm run build
npm run typecheck
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3181
# En otra terminal:
python3 scripts/qa-admin-produccion.py --output /tmp/admin404-browser
git diff --check
```

Los siete sondeos HTTP se ejecutaron con `urllib.request` al mismo servidor: `/administracion` y `/cuenta` (200), `/api/administracion/acceso`, `/api/administracion/usuarios/reales` y `/api/administracion/roles` sin bearer (401 y no-store), `/desarrollo/panel-admin` y `/desarrollo/mfa-admin` (404). Se verificó que el HTML inicial no incluye los datos de perfil del fixture.

## Diferencias de configuración y pendientes de producción

Se consultaron metadatos de variables de Vercel **sin descifrar ni imprimir valores**. La configuración pública de Supabase y `DENTAIA_ADMIN_PREVIEW_ENABLED` aparece con targets Preview/Production; `DENTAIA_ADMIN_WORKFLOWS_ENABLED` está limitada a Preview develop. No aparecen `DENTAIA_ADMIN_READS_ENABLED` ni `DENTAIA_SUPABASE_ADMIN_READ_SECRET` en el listado consultado. Esto es evidencia de configuración, no una prueba de conexión ni de igualdad de valores en las sesiones reales. No se modificaron variables, usuarios o proyectos.

Después de aprobar el PR, antes de validar la consulta real en Production:

1. Aprobar merge/despliegue expresamente. Esta entrega no hace ninguno ni activa producción.
2. Verificar que el despliegue de main expone las variables de sistema de Vercel requeridas (`VERCEL=1`, `VERCEL_ENV=production`, `VERCEL_GIT_COMMIT_REF=main`, `NODE_ENV=production`). No falsificarlas mediante query, formulario o cabeceras.
3. Si se autoriza el listado real, aprovisionar en **Production** `DENTAIA_ADMIN_READS_ENABLED=true` y `DENTAIA_SUPABASE_ADMIN_READ_SECRET` desde un gestor seguro. Mantener URL/clave publicable del proyecto autorizado. No enviar secretos al chat ni usar variables NEXT_PUBLIC para la credencial privada. No se pueden inventar o copiar automáticamente credenciales que no están disponibles.
4. Mantener bloqueos de escritura. Esta corrección no habilita cambios de roles, ubicaciones ni workflows en Production; esas activaciones requieren revisión y autorización específicas.
5. Desplegar el commit aprobado, confirmar SHA/alias y comprobar personalmente con cuentas autorizadas: login real, MFA real, cuenta → panel, listado y denegaciones. Sin la configuración de lectura, una consulta autorizada devuelve un error controlado/503; **no debe volver a convertirse en 404 ni en éxito simulado**.

El PR Preview de esta rama de corrección conserva su 404 administrativo por la política de Preview: no es develop y este PR no amplía ese permiso. El escenario que corrige se prueba en build local con el contexto de Production/main. Las pruebas sintéticas no equivalen a autenticación/MFA ni lectura real de Supabase. No se dispone de sesiones autorizadas ni se ejecutan scripts con credenciales privadas para sustituir la aceptación final.

El commit y PR se enlazan en la entrega después de publicarlos. Se deja main y su despliegue actual intactos hasta recibir aprobación del responsable.
