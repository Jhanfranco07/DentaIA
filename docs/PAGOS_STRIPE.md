# Integración de Pagos con Stripe (Sandbox)

## Estado de la revisión del PR #48

La tabla `payments` ya fue aplicada y verificada en la fase de base de datos autorizada, con versión `20261113011041` y nombre `payments`. Esta revisión de código no aplica SQL ni modifica su esquema, RLS o historial remoto.

La persistencia actual respeta ambos UNIQUE: inserta primero y, ante `23505`, verifica sesión, propietario y datos económicos. Conserva el primer `stripe_event_id`; una sesión `unpaid` puede avanzar a `paid`, `failed` o `expired` mediante UPDATE condicionado por estado. Una confirmación verificada no retrocede ante un fallo asíncrono tardío; los estados `paid` y `expired` permanecen terminales. Se soportan `checkout.session.async_payment_succeeded` y `checkout.session.async_payment_failed`. Colisiones de eventos pertenecientes a otra sesión y errores de almacenamiento se propagan como error para conservar el reintento del webhook.

No es un ledger de todos los eventos Stripe: los eventos posteriores no reemplazan el identificador inicial. No se agregaron tablas ni RPC. Los escenarios se prueban con fixtures; no se presenta esta validación como un cobro real o una prueba end-to-end de Stripe.

Checkout conserva `id` y devuelve además la URL consumida por la interfaz. Las claves continúan exclusivamente en la configuración existente, sin cambios de secretos. Las pruebas Vitest se ejecutan junto a las pruebas Node en el job de pruebas de DevSecOps.


## 1. Objetivo y Alcance
Este documento detalla la configuración y arquitectura del flujo de pagos en entorno de pruebas para la plataforma.

## 2. Simulación de Pagos
Todas las transacciones se ejecutan estrictamente en modo prueba (Test Mode). No se procesan cargos reales ni se utiliza dinero real.

## 3. Creación del Sandbox y Claves
1. Crear cuenta en Stripe y activar el modo Test Mode en el dashboard.
2. Ir a Developers > API keys y copiar la clave publicable (pk_test_...) y la clave secreta (sk_test_...).

## 4. Instalación de Stripe CLI en Windows
Ejecutar en PowerShell: winget install Stripe.StripeCLI

## Tabla `payments`
| Columna | Descripción |
|---|---|
| user_id | Usuario de Supabase que pagó |
| stripe_session_id | Sesión de Checkout (única) |
| stripe_event_id | Evento del webhook (único, evita duplicados) |
| plan, amount_total, currency | Plan y monto en la unidad mínima definida por Stripe para esa divisa |
| status | paid, unpaid, expired o failed |

RLS activo: cada usuario solo lee sus pagos. Solo el servidor escribe.

## Endpoint `POST /api/stripe/checkout`
- Requiere el encabezado `Authorization: Bearer <access_token de Supabase>`.
- 401 si no hay sesión válida. 502 si Stripe falla.
- Respuesta correcta: `{ "url": "https://checkout.stripe.com/..." }`.

## Webhook `POST /api/stripe/webhook`
Verifica la firma con `STRIPE_WEBHOOK_SECRET` y es idempotente (`stripe_event_id` único).
| Evento | Acción |
|---|---|
| checkout.session.completed | Guarda el pago (`paid` o `unpaid`) |
| checkout.session.expired | Guarda el pago como `expired` |
| checkout.session.async_payment_succeeded | Actualiza el pago a `paid` |
| checkout.session.async_payment_failed | Actualiza el pago a `failed` |
| Otros | Se ignoran (200) |
# Stripe Sandbox — Fase 3: base de datos

## Alcance y fuente

Esta fase prepara únicamente `public.payments`, sus permisos y tipos. No implementa Checkout, webhooks, páginas de pago ni cambios en Supabase remoto. Fuente revisada: `STRIPE_DB.md.pdf`, sección FASE 3, y requisitos del responsable. Los pasos 19–25 representan la evolución de **un mismo archivo**, no números de commits Git. Se conservan siete commits progresivos sin ejecutar versiones intermedias; los SHA se consultan con `git log --reverse origin/main..HEAD`.

Base de implementación: `main` `d345faa130198ce6580c94ba351a28415f863f36`, árbol limpio antes de modificar. Se actualizaron las referencias sin sobrescribir trabajo local. Se revisaron las cuatro migraciones existentes, tipos, scripts y PR #48 (`feature/stripe-sandbox`, `5e225dea994c770dd245032bc4c77770dcb90991`). En esta base no había tabla, migración ni tipo `payments` versionados.

Migración única, generada por `supabase migration new payments` (CLI 2.81.3):

`supabase/migrations/20261113011041_payments.sql`

Timestamp UTC único, coherente con el formato de 14 dígitos del repositorio. El ejemplo de fecha del PDF no se reutiliza. La transacción `BEGIN/COMMIT` incluye tabla, permisos, índice y RLS: un error revierte el conjunto.

## Tabla `payments`

Una fila por sesión Stripe, vinculada al usuario de Supabase Auth. Es un registro académico de pagos de prueba; no representa una suscripción ni concede derechos premium por sí mismo.

| Columna | PostgreSQL | Restricciones / DEFAULT | TypeScript |
| --- | --- | --- | --- |
| id | UUID | PK, NOT NULL, `gen_random_uuid()` | string |
| user_id | UUID | NOT NULL, FK `auth.users(id) ON DELETE CASCADE` | string |
| stripe_session_id | TEXT | NOT NULL, UNIQUE | string |
| stripe_event_id | TEXT | NOT NULL, UNIQUE | string |
| plan | TEXT | NOT NULL | string |
| amount_total | INTEGER | NOT NULL | number |
| currency | TEXT | NOT NULL | string |
| status | TEXT | NOT NULL, CHECK `paid`, `unpaid`, `expired` en la migración inicial | PaymentStatus |
| created_at | TIMESTAMPTZ | NOT NULL, `now()` | string (fecha serializada) |

`amount_total` se almacena en la **unidad monetaria mínima de la divisa según Stripe**, no necesariamente en centavos: hay monedas sin decimales y reglas específicas. No dividir siempre entre 100. La validación de moneda, plan e importe frente a la sesión Stripe corresponde al backend; no se agregan defaults ni restricciones comerciales no solicitadas. INTEGER limita el rango a -2147483648…2147483647; no se añade un CHECK de no negatividad ajeno al contrato recibido.

Índice B-tree `payments_user_id_idx(user_id)`: facilita lecturas por propietario y búsqueda de filas dependientes de Auth. Los dos UNIQUE generan además índices propios.

## Permisos y RLS

- Se revocan explícitamente todos los permisos sobre **esta tabla** de `PUBLIC`, `anon`, `authenticated` y `service_role`, neutralizando grants por defecto. No se modifican default privileges globales ni otras tablas.
- `authenticated` recibe exclusivamente SELECT. La única política, `payments_select_own`, permite leer cuando `user_id = (select auth.uid())`. Una sesión sin identidad no obtiene filas. Filtrar por otro usuario desde el cliente no evade RLS.
- `anon` no recibe permisos: ni siquiera puede consultar con un filtro o identificador conocido.
- No existen políticas INSERT, UPDATE o DELETE para clientes. Tampoco grants de escritura, TRUNCATE, REFERENCES o TRIGGER para esos roles. Se prueban ambas barreras, incluso concediendo permisos de escritura temporalmente en un fixture que luego se revierte.
- `service_role` recibe SELECT, INSERT, UPDATE y DELETE, no ALL. Se apoya en el rol privilegiado que ya proporciona Supabase, sin crear o alterar roles productivos ni añadir políticas de bypass para pacientes.
- La FK elimina los pagos al eliminar el usuario. Este comportamiento solicitado no equivale a una política de conservación contable para producción.

El webhook futuro debe validar la firma Stripe, trabajar con el cuerpo original, asociar una identidad autorizada de Supabase y persistir desde un contexto **exclusivo del servidor**. La credencial service role nunca debe llegar al navegador, logs o campos de la tabla. Un cliente privilegiado no debe heredar la sesión de un paciente. Aquí no se implementa ni modifica ese webhook, ni se utilizan credenciales reales.

No se almacenan tarjetas, CVC, secretos Stripe ni claves de Supabase. Los identificadores Stripe, usuario y monto siguen siendo datos que requieren control de acceso.

## Idempotencia y coordinación con PR #48

- `stripe_event_id` UNIQUE impide registrar dos veces el mismo evento, también con entregas concurrentes. El backend puede ignorar una reentrega ya procesada mediante `ON CONFLICT (stripe_event_id) DO NOTHING`, sin generar una segunda fila.
- `stripe_session_id` UNIQUE garantiza una fila por sesión.
- **No son equivalentes**: otro evento con un nuevo event ID para una sesión existente viola el UNIQUE de sesión. El `upsert(..., { onConflict: "stripe_event_id", ignoreDuplicates: true })` de PR #48 no cubre ese caso. Debe acordarse con Stephan el tratamiento de eventos distintos y transiciones antes de dar por completa la integración; esta fase no modifica ni relaja la restricción solicitada.
- En la migración inicial, `paid`, `unpaid` y `expired` eran los únicos estados persistibles. Una migración aditiva de esta rama agrega `failed`; no se modifica ni reescribe la migración original.

`src/types/payments.ts` se incorpora **idéntico en bytes** al del PR #48, con `PaymentStatus` y `Payment`, sin imports circulares. Los tipos de Supabase mantienen el estilo inline actual y todas las tablas/relaciones existentes. `Row` coincide con `Payment`; `Insert` exige los siete campos sin DEFAULT y permite omitir o especificar `id`/`created_at`; `Update` permite campos opcionales, sin conceder permisos SQL. `Relationships: []` sigue el patrón actual de tipos para FK a Auth fuera del esquema público; la FK SQL sí se verifica.

El PDF simplifica Insert omitiendo completamente los campos con DEFAULT; aquí se corrige para permitir enviarlos opcionalmente. Las comprobaciones de compilación están en `supabase/tests/payments-types.ts`.

Ambas ramas crean `docs/PAGOS_STRIPE.md` desde bases sin ese documento: se prevé conflicto add/add. Al integrar, conservar el contenido de configuración y endpoints de Stephan y la descripción/permisos de esta fase; corregir su referencia general a centavos. No se modificó su rama o PR. Los tipos de pagos idénticos deben conservar una sola definición.

## Aplicación y verificación

**No se ha aplicado esta migración en Supabase remoto. No ejecutarla allí sin autorización explícita.** Tampoco se ejecutó `supabase db push` ni se utilizó SQL Editor de producción. La instrucción del PDF de aplicar el SQL al finalizar queda subordinada a esa restricción.

1. Revisar el archivo final completo, sus siete pasos, conflictos y validaciones. Nunca aplicar snapshots de los primeros commits: están incompletos.
2. Validar primero en un PostgreSQL/Supabase **aislado** con las dependencias `auth.users`, `auth.uid()`, los roles estándar y `gen_random_uuid()` disponibles. Las migraciones anteriores del repositorio dependen del esquema preexistente de la aplicación y no reconstruyen por sí solas un Supabase completo.
3. En un proyecto Supabase local ya inicializado, usar su flujo local de migraciones, revisar el historial y probar Auth/RLS allí. No cambiar el enlace a un proyecto remoto ni ejecutar un push como parte de estas pruebas.
4. Tras autorización del responsable, confirmar destino, backup y versiones pendientes con el procedimiento de migraciones del equipo. Aplicar **solo la versión final** de este archivo en una transacción. No borrar/recrear datos mediante `IF NOT EXISTS`, ni alterar timestamps ya aplicados.
5. Verificar columnas/defaults, FK, índice, dos UNIQUE, CHECK, `relrowsecurity`, única política y grants. Comprobar propietarios con dos sesiones reales en ese entorno autorizado y confirmar ausencia de escrituras desde clientes.

Consultas de inspección (ejecutarlas únicamente en el destino autorizado):

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'payments'
order by ordinal_position;
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid = 'public.payments'::regclass;
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'payments';
select relrowsecurity from pg_class where oid = 'public.payments'::regclass;
select * from pg_policies where schemaname = 'public' and tablename = 'payments';
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'payments';
```

## Pruebas reproducibles sin producción

`scripts/test-payments-postgres-local.cjs` solo admite un directorio de socket Unix, no URL/host TCP, y exige que el servidor no escuche TCP y que su base administrativa no contenga Auth de la aplicación. Crea una base de nombre aleatorio `dentaia_stripe_*`, fixtures mínimos Auth y roles NOLOGIN (service_role BYPASSRLS **solo en el clúster de prueba**), y elimina la base creada al terminar. No debe apuntarse a un clúster de trabajo compartido. El fixture concede deliberadamente defaults permisivos para comprobar que la migración los neutraliza.

Ejemplo Linux, con PostgreSQL nativo instalado y usuario no root. No exportar credenciales ni reutilizar PGDATA del proyecto:

```bash
mkdir -p /tmp/dentaia-stripe-socket
initdb -D /tmp/dentaia-stripe-pg --username=postgres --auth-local=trust --auth-host=reject --encoding=UTF8 --no-locale
pg_ctl -D /tmp/dentaia-stripe-pg -l /tmp/dentaia-stripe.log \
  -o "-k /tmp/dentaia-stripe-socket -c listen_addresses='' -p 55438" start
# Driver solo en herramientas temporales, sin tocar package.json/package-lock.json:
npm install --prefix /tmp/dentaia-stripe-tools --save-exact pg@8.16.3
NODE_PATH=/tmp/dentaia-stripe-tools/node_modules node scripts/test-payments-postgres-local.cjs \
  --socket /tmp/dentaia-stripe-socket --output /tmp/dentaia-stripe-resultados.json
pg_ctl -D /tmp/dentaia-stripe-pg stop
```

La prueba de fallo inyecta división entre cero antes de COMMIT y comprueba rollback de tabla/índice/política y conservación de una tabla centinela **local**. No prueba un fallo en producción: el aislamiento garantiza que el ejecutor no acepta destinos remotos; no se conectó a Supabase para simularlo. Las pruebas fixture no acreditan Auth/JWT/PostgREST reales ni la configuración remota de grants heredados; requieren aceptación posterior en un entorno Supabase autorizado.

## Sandbox y límites

Stripe Test Mode no cobra dinero real. Esta tabla no fuerza por sí misma el modo de la cuenta o de las claves Stripe: eso debe garantizarlo la integración de servidor. No se registran pruebas de Checkout/webhook/Stripe CLI como realizadas en esta fase. El formato de identificadores es opaco; el backend verificará su origen. No habilitar pagos productivos ni conceder acceso premium automáticamente a partir de este trabajo.

Los resultados ejecutados, limitaciones de herramientas y estado de DevSecOps se recogen en `docs/evidencias/stripe-db/VALIDACION.md` y en el Pull Request. No se modificaron variables persistentes, secretos, autenticación, AAL2, roles remotos, políticas ajenas, módulos funcionales, Vercel o Jira. El PR queda sin merge y la aplicación de la migración requiere autorización aparte.

## Integración aislada Stripe Sandbox + Premium

La rama de integración reutiliza el Checkout `mode: payment`, el webhook firmado,
la escritura server-only en `payments`, el historial RLS y las páginas de PR #48.
No se cambia a `mode: subscription`: no se encontró una definición comercial
aprobada de precio, periodo ni reglas de renovación. Los 20 USD configurados
por PR #48 se conservan únicamente como importe ficticio de demostración, no
como precio comercial.

Un pago confirmado crea un registro en `payments`; **no** crea ni actualiza una
fila de `premium_subscriptions` y no habilita capacidades Premium. La interfaz
de éxito lo informa explícitamente. Smile V17 Basic no depende de este pago.
Las capacidades de historial, comparación, compartir y análisis avanzado
siguen con `implemented: false`.

El contrato `premium_subscriptions` y el ledger `stripe_webhook_events` de PR
#72 se incluyen para preparar el trabajo recurrente, pero esta integración no
los escribe. No se registran eventos de Checkout de pago único en ese ledger:
la idempotencia actual de `payments` conserva sus dos restricciones únicas
(`stripe_event_id` y `stripe_session_id`) y las transiciones condicionales ya
probadas. Un futuro ciclo recurrente requerirá decisión comercial, procesamiento
transaccional/idempotente de sus eventos y revisión de estados antes de activar
Premium. La migración de suscripciones permanece sin aplicar remotamente.

El webhook conserva el cuerpo original y valida la firma; además rechaza
eventos Live, exige modo `payment`, UUID de usuario y coincidencia de plan,
importe y moneda con la configuración de demostración del servidor. Los
eventos no dirigidos a este producto se ignoran, los errores de almacenamiento
devuelven 500 para permitir el reintento de Stripe y los cuerpos mayores a 1
MiB se rechazan. El retorno del navegador solo consulta `payments` bajo RLS y
nunca es autoridad de pago.

El endpoint `GET /api/premium/status` requiere bearer válido, verifica la
identidad con Auth y deriva el plan en servidor mediante el adaptador RLS
server-only. No acepta identificador de usuario ni plan de la petición. El
frontend presenta carga, error/reintento y estado de sesión; el plan mostrado
no habilita por sí solo funciones Premium.

Para desarrollo local, `.env.example` documenta `STRIPE_SECRET_KEY`
(`sk_test_`), `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` y
`NEXT_PUBLIC_SITE_URL`. La clave service-role y los secretos Stripe son solo
de servidor. Las URLs de retorno requieren HTTPS salvo loopback local.
No se configuraron Railway/Vercel Production ni Stripe Live. Se validó un
Checkout real de Stripe Sandbox por USD 20.00: `checkout.session.completed`,
webhook HTTP 200, persistencia `paid` en Supabase local y consulta del pago en
`/cuenta` desde una sesión autenticada. La reentrega del evento existente
confirmó idempotencia; no se repitió Checkout. Las pruebas automatizadas siguen
siendo fixtures y no sustituyen esa comprobación manual. No se guardan
credenciales ni capturas con datos de cuenta en Git.

La migración `payments_failed_status`, originalmente versionada como
`20261117050000`, se conserva como
`20261117150510_payments_failed_status_20261117050000.sql` para coincidir con
el identificador registrado en Production. Amplía el CHECK de `payments` con
`failed` y procesa los eventos asíncronos de fallo. Una
confirmación verificada prevalece sobre un fallo que se haya recibido primero;
un fallo tardío no puede degradar un pago confirmado. La expiración conserva la
semántica terminal ya probada. Ninguna migración se aplicó en Supabase remoto.

## Historial y rol inicial de paciente

`/cuenta` consulta `payments` únicamente después de verificar la sesión con
Supabase Auth y solicita solo los campos que presenta. La lectura sigue sujeta
a `payments_select_own`; la interfaz no filtra ni decide la propiedad del pago.
Sin sesión se ofrece iniciar sesión, y los errores de consulta permiten volver
a intentar. Un pago de demostración no crea una suscripción Premium.

El alta no confía en `user_metadata` ni en un rol recibido del navegador. Si una
identidad confirmada no tiene asignación DentaIA, la interfaz llama al endpoint
server-only `POST /api/cuenta/provision-patient-role`. El servidor vuelve a
verificar la identidad, lee `app_metadata` con Auth Admin, asigna únicamente
`paciente` cuando no existe asignación y preserva los roles ya provisionados.
Una asignación DentaIA inválida requiere revisión administrativa; no se
normaliza automáticamente.

La comprobación funcional local cubrió carga, historial vacío, error HTTP 503,
reintento correcto y presentación de una fila `paid` con un fixture de interfaz.
Además, una captura aportada después del reinicio de `next dev` muestra el pago
existente en `/cuenta` con sesión autenticada. La consulta usa la política RLS
de propietario; la prueba pgTAP verifica aparte el aislamiento entre cuentas y
la denegación de escrituras cliente. No se repitió Checkout.

---

## Suscripciones Premium mensuales en PR #76 (Preview académico)

Esta ampliación **no sustituye retroactivamente el pago único** de `/api/stripe/checkout`: incorpora un flujo separado `/api/stripe/subscription/checkout`, cancelación `/api/stripe/subscription/cancel` y webhooks firmados de ciclo de vida. La página `/premium` utiliza el nuevo flujo de suscripción mensual.

**Alcance:** únicamente Vercel Preview de la rama `integration/pr71-pr74-compat-20261117` con `DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED=true`. Production sigue sin habilitar suscripciones desde estas rutas. Stripe permanece estrictamente en modo prueba (`sk_test_...`).

### Variables de Vercel (solo del servidor, salvo SITE_URL)

- `STRIPE_SECRET_KEY`: clave de Stripe Test Mode con prefijo `sk_test_`.
- `STRIPE_WEBHOOK_SECRET`: secreto específico del endpoint de webhook Test Mode, prefijo `whsec_`.
- `SUPABASE_SERVICE_ROLE_KEY`: credencial privilegiada de Supabase **solo en Vercel Preview, en servidor**, con permiso INSERT/UPDATE/SELECT en `public.premium_subscriptions`; imprescindible para registrar eventos verificados. Nunca colocarla en `NEXT_PUBLIC_*`, commits o mensajes.
- `NEXT_PUBLIC_SITE_URL`: URL HTTPS del alias del Preview de integración.
- `DENTAIA_STRIPE_SUBSCRIPTIONS_ENABLED=true`: Preview de esta rama.
- `STRIPE_PREMIUM_PRICE_ID` (opcional): Price mensual existente en Stripe Test Mode, **S/ 14.90 por mes**. Si falta, Checkout crea `price_data` recurrente de S/ 14.90 mensuales del lado del servidor; no se acepta un precio o plan enviado por el navegador.

El Checkout comprueba en servidor la sesión autenticada y el acceso a la base. Si falta la credencial administrativa, devuelve un error antes de crear una sesión de Stripe. El webhook no debe considerarse probado si no se ha verificado su entrega real.

### Webhook Stripe Test Mode

Crear un destino en Stripe Dashboard (modo prueba) apuntando a:

`https://dent-ai-git-integration-pr71-pr74-aa5dad-jhan-francos-projects.vercel.app/api/stripe/webhook`

Suscribirse a:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

El endpoint verifica la firma de Stripe y rechaza eventos Live. Consulta el estado canónico de la suscripción en Stripe, verifica que la metadata identifica a un usuario DentaIA, comprueba el importe/moneda/intervalo recurrente y conserva eventos en orden por fecha, sin aceptar una activación declarada por el cliente. La tabla de Supabase solo permite lectura del propietario mediante RLS; la escritura ocurre en el backend con clave de servicio.

### Comportamiento visible

1. Paciente autenticado → menú **Mi plan Premium** → `/premium`.
2. Pulsa **Contratar Premium mensual (prueba)** → Checkout `mode=subscription`, S/ 14.90/mes.
3. Utiliza un método de prueba Stripe. Regresa a `/premium/exito`, que **no acredita** el pago por la redirección.
4. El webhook registra o actualiza `premium_subscriptions`. El endpoint `/api/premium/status` (token obligatorio) calcula `premium` solo si `status=active` y el período está vigente.
5. Puede pulsar **Cancelar al final del período**. Stripe conserva el plan hasta el vencimiento y comunica el cambio por webhook; finalizado el período, el usuario vuelve a Basic. Una renovación pagada se refleja mediante el evento `customer.subscription.updated`.
6. Una suscripción pendiente, vencida, `past_due`, `unpaid` o cancelada no proporciona acceso Premium.

**Límites:** El plan Premium queda identificado y verificable en servidor, pero los módulos avanzados Smile que figuran con `implemented:false` en el catálogo siguen deshabilitados; no se presentan como prestaciones ya listas. El registro de pagos únicos y el historial de `payments` son independientes del registro de suscripciones. Pendiente una prueba extremo a extremo autenticada y confirmación de entrega del webhook con las credenciales administradas en Vercel.

**Compatibilidad:** la suscripción de prueba creada antes del ajuste conserva su precio histórico de USD 20. El webhook sigue reconociéndola únicamente cuando su `stripe_price_id` ya existe en la base; nuevas contrataciones usan PEN 14.90 mensuales. Este cambio no migra ni cancela automáticamente las suscripciones previas.
