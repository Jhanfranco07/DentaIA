<<<<<<< HEAD
﻿# Integración de Pagos con Stripe (Sandbox)

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
| plan, amount_total, currency | Plan y monto en centavos |
| status | paid, unpaid o expired |

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
| Otros | Se ignoran (200) |
=======
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
| status | TEXT | NOT NULL, CHECK `paid`, `unpaid`, `expired` | PaymentStatus |
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
- `paid`, `unpaid`, `expired` son los únicos estados persistibles de este contrato. No hay máquina de estados ni ordenamiento automático de eventos en esta migración.

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
>>>>>>> origin/main
