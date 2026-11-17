# Evidencia de Fase 3

## Resultado local ejecutado

| Verificación | Resultado |
| --- | --- |
| PostgreSQL 17.6 nativo | **39 aprobadas, 0 fallidas**: `sql.json` contiene cada caso |
| Sintaxis SQL | Parseo y ejecución de la migración final en PostgreSQL real, dentro de transacción |
| Restricciones | PK, FK CASCADE, dos UNIQUE, CHECK de estados, NOT NULL, defaults, INTEGER e índice válidos |
| Permisos/RLS | Tres propietarios aislados; sin sub no hay filas; anon sin lectura; clientes sin INSERT/UPDATE/DELETE/TRUNCATE; service_role fixture puede escribir |
| Defensa adicional RLS | Con grants erróneos temporales, INSERT falla y UPDATE/DELETE no afectan filas; la transacción revierte esos grants |
| Idempotencia | Duplicados rechazados; reentrega por evento ignorada; segundo evento de la misma sesión reproduce conflicto del contrato |
| Rollback | Fallo inyectado antes de COMMIT revierte la tabla y sus objetos dependientes; centinela local intacta |
| TypeScript | `npm run typecheck`, exit 0 después del build; incluye `payments-types.ts`, con errores negativos esperados |
| Preservación de tipos | Eliminando únicamente import/nuevo bloque payments, el archivo coincide en bytes con main; `Payment` coincide con PR #48 |
| Pruebas Node | **493 aprobadas, 0 fallidas/omitidas**: todos los `*.test.mjs` de src/features y src/app, incluidas integraciones existentes |
| Build Next.js 15.5.28 | `npm run build`, exit 0; `build.log` |
| ESLint independiente | No disponible: sin script, configuración ni dependencia. El mensaje del build no acredita una ejecución independiente de ESLint |
| Diff | `git diff --check` sin errores |

Node local: 24.19.0. Para instalar herramientas se usaron directorios temporales externos al proyecto; no se cambiaron sus dependencias. Supabase CLI 2.81.3 generó el único archivo de migración; no se conectó a un proyecto ni ejecutó `db push`. PostgreSQL nativo proviene de `@embedded-postgres/linux-x64@17.6.0-beta.15`; solo se usan sus binarios, no hay emulación de RLS.

Primer intento SQL: 38 aprobadas/1 fallida por una expectativa del arnés: `pg_policies.roles` es `name[]` y el driver lo devolvía como texto. Se convirtió a `text[]` en la consulta de inspección, sin cambiar la política ni el esquema, y la batería completa pasó. Primer intento TypeScript: falló por tipos Next generados de rutas antiguas de la copia local. El build regeneró esos artefactos; el chequeo completo posterior pasó sin cambios ajenos. No se cuentan los primeros intentos como aprobados.

## Comandos ejecutados

```bash
# Después del séptimo commit SQL, nunca sobre versiones parciales:
NODE_PATH=/workspace/work/stripe-tools/node_modules node scripts/test-payments-postgres-local.cjs \
  --socket /workspace/work/stripe-socket --output /workspace/work/stripe-evidence/sql.json
mapfile -d '' tests < <(find src/features src/app -name '*.test.mjs' -print0)
node --experimental-strip-types --test --test-reporter=tap "${tests[@]}"
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run typecheck
git diff --check
# Comparación que NO modifica el índice, árbol de trabajo ni las ramas:
git merge-tree --write-tree --name-only HEAD origin/feature/stripe-sandbox
```

`resumen.json` incluye hashes de la migración y del PDF recibido. Los fixtures usan roles y usuarios sintéticos exclusivamente en el clúster local. No se cargaron credenciales Stripe ni service role reales, ni se cambiaron archivos de entorno.

## Coordinación con PR #48

`merge-pr48.txt` registra tres conflictos: add/add de `docs/PAGOS_STRIPE.md`, contenido de `.env.example` y `src/app/cuenta/page.tsx`. Estos dos últimos son divergencias de la rama de Stephan frente al main actual; esta fase no modifica esos archivos. `src/types/payments.ts` es idéntico en bytes y no figura como conflicto. El merge-tree solo calcula objetos Git para inspección; no hace merge ni cambia su PR.

La estructura DB está preparada para revisión, pero eso no significa que la integración completa de Stripe esté aprobada. Además de resolver conflictos, Stephan debe tratar eventos distintos sobre una sesión existente y representar importes según la divisa.

## Límites

No se probó un fallo sobre producción ni se aplicó allí SQL: el ensayo de atomicidad es local y el runner rechaza destinos TCP. La ausencia de cambios remotos se debe al alcance de ejecución, no a una comparación de datos de producción. No se realizaron pruebas reales de Stripe, JWT/Auth, PostgREST ni aceptación del webhook. El fixture no reemplaza la aceptación posterior en un Supabase autorizado.

La ejecución real de DevSecOps sobre el commit final y el enlace del PR se informan en el propio Pull Request; esta documentación no declara CI remoto aprobado antes de observarlo. El push de feature puede omitir Build según la política vigente; se verificará también el evento pull_request, que sí lo exige. No se cambia ese workflow ni los módulos FastAPI/visión para esta tarea.

## Cierre funcional y RLS de PR #75 — 17 de noviembre de 2026

### Entorno y datos

- La ejecución se hizo contra Supabase local en loopback. `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_URL` se verificaron como locales; Stripe usó una clave `sk_test_`, y había secreto de webhook y service role local. Los valores no se imprimieron.
- `.env.local`, `.env.qa.local` y `.env.production.backup.local` permanecieron ignorados por Git. No se consultó ni modificó Supabase Production, Railway, Vercel o Stripe Live.
- `npm run check:supabase` conectó al stack local, encontró cuatro perfiles ficticios y no permitió lecturas privadas como visitante. Auth opcional no se probó mediante ese script.

### Checkout existente e idempotencia

- Se reentregó una vez el evento Sandbox ya procesado `evt_1UcfwrGZ2pFOxdhPrWxHRrj` al webhook de loopback, con firma de prueba válida. El webhook respondió HTTP 200.
- La comparación previa/posterior observó exactamente una fila para el evento y para su `stripe_session_id`; estado `paid`, USD 20.00 y propietario sin cambios. No se creó ni activó una suscripción Premium.
- Una consulta agregada posterior volvió a confirmar una fila por evento/sesión, estado `paid`, importe esperado y ausencia de Premium para el propietario. No se repitió Checkout ni se enviaron eventos adicionales.

### Historial, alta y autorización

- En `/cuenta?perfil=1`, una sesión ficticia local verificó los estados de comprobación/carga y vacío. Un 503 simulado mostró el error accesible y el botón «Reintentar» recuperó la consulta.
- La presentación de una fila `paid` (fecha, USD 20.00 y estado) se verificó con una respuesta REST simulada en el navegador; el fixture no escribió en Supabase. No se inició sesión como propietario del Checkout existente, por lo que no se declara una lectura visual de su transacción real.
- El flujo local de alta confirmó que una identidad nueva confirmada recibe únicamente el rol `paciente` mediante `app_metadata` de servidor; el endpoint no confía en `user_metadata` ni en datos de rol del cliente y preserva asignaciones existentes. Se añadieron siete pruebas unitarias del endpoint, incluida la denegación de identidades no confirmadas.
- La prueba pgTAP `payments_rls.sql` aprobó 8 aserciones dentro de una transacción revertida: lectura propia, aislamiento de la otra cuenta, denegación de INSERT/UPDATE/DELETE, bloqueo de lectura del ledger, estado `failed` y ausencia de Premium. No se modificaron privilegios para hacer pasar las pruebas.
- Se retiraron cinco cuentas de prueba `example.test` de Supabase local tras verificar que ninguna tenía pagos ni suscripciones; no se borró el pago del Checkout Sandbox.

### Validaciones de código ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Node unitarias | 473 aprobadas en 70 archivos |
| Node integración | 11 aprobadas |
| Node contratos | 16 aprobadas |
| Node regresión | 4 aprobadas |
| Vitest (`npm test`) | 66 aprobadas en 12 archivos |
| Catálogo Basic/Premium | 2 aprobadas |
| Pruebas focalizadas endpoint/Stripe/Premium | 23 aprobadas en 4 archivos |
| pgTAP ejecutado en esta validación | 33 aprobadas en 5 archivos (DI-131, Smile, Premium, pagos `failed` y pagos RLS) |
| DI-172 local | 45 aprobadas en la reconstrucción DI-36 ya documentada arriba; no se repitió una reconstrucción destructiva sobre la base con el Checkout existente |
| TypeScript | `npm run typecheck`, exit 0 |
| Build | `npm run build`, exit 0; muestra advertencias Autoprefixer preexistentes en CSS no relacionado |
| Dependencias JavaScript | `npm audit`, cero vulnerabilidades |
| Diff | `git diff --check`, sin errores |

El conjunto pgTAP documentado previamente (70 aserciones, incluido DI-172) más las 8 nuevas aserciones de `payments_rls.sql` suma 78 aserciones locales acumuladas; no se ejecutaron todas en una sola invocación.

### CI/CD y límites

Para el commit `ef0264a`, CI, TypeScript, Build Next.js, Automated Testing,
Security, Backend IA, DevSecOps y los gates de Continuous Delivery terminaron
en verde en GitHub Actions. Vercel Preview y su comprobación HTTP también
pasaron; el workflow solo observó el estado del proveedor y una URL pública
Preview. No hubo estado Railway para este commit. El paso `Production ·
autorización externa` documentó que no se publica Production desde Actions;
no se hizo promoción ni despliegue productivo.

El build local terminó, pero compartir `.next` con el servidor de desarrollo
rompió temporalmente ese proceso; se reinició Next.js en `localhost:3000` y se
verificó `/premium` con HTTP 200. No hacer merge a `main` hasta cerrar la
comprobación visual del historial con la sesión exacta del propietario del
pago, además de la revisión humana requerida.

La comprobación visual del historial con la sesión exacta del propietario del Checkout queda pendiente; RLS y el renderizado de la fila se verificaron por separado. Production sigue bloqueada hasta obtener autorización de despliegue y realizar las comprobaciones remotas de migraciones pertinentes. No hacer merge a `main` hasta revisar los checks del PR y cerrar esa prueba manual de propiedad del pago.
