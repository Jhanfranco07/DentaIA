# Fase 2: auditoría de migraciones Supabase

Fecha: 2026-11-16. Rama: `feature/auditoria-migraciones-supabase`.

## Alcance y límites

Esta fase no aplica SQL ni Storage al proyecto remoto. Tampoco modifica las ramas de
Anelis, Angie o Stephan. Las migraciones nuevas quedan bloqueadas hasta contrastar el
esquema remoto y disponer de una base Supabase/PostgreSQL aislada.

## Inventario versionado

`main` contiene las migraciones DI-151, directorio/ubicaciones/reseñas y
`20261113011041_payments.sql`. No contiene `smile_analyses`,
`smile_analysis_consents`, `premium_subscriptions`, `stripe_webhook_events`,
`smile_analysis_access_grants` ni `dentist_services`.

La rama `origin/feature/DI-172-rutinas` contiene
`20261116090000_di172_rutinas.sql`. Debe incorporarse sin cambiar su versión ni
reescribir su contenido cuando se valide en la base aislada.

La rama `origin/feature/angie-di131-catalogo` no aporta migración de Supabase al
momento de esta auditoría; sus cambios son de presentación del directorio. La rama
`origin/feature/stripe-sandbox` contiene integración de aplicación, mientras que
`payments` ya está versionada en `main`.

## Recuperación de la cadena base

La comparación con las once versiones remotas confirma que faltan las dos
migraciones de octubre y las cuatro de DI-36. Se localizaron los cuatro SQL
originales de DI-36 en el commit `869db03`, fuera de `supabase/migrations`:

| Versión remota | Archivo original | SHA-256 documentado |
| --- | --- | --- |
| 20261104004040 | `docs/arquitectura/integracion_fase8/migraciones/20261103235358_di36_dentalia_01_administracion.sql` | `8f5117d6040e6db4190e9e66cd2198bb26f62d6da96065521e51bc505a7c8181` |
| 20261104004047 | `docs/arquitectura/integracion_fase8/migraciones/20261103235408_di36_dentalia_02_modelo_clinico.sql` | `19c3253d3b4655e3a812a1740fb8757071dcdab7a2d6d7b812478ea3648cb6f1` |
| 20261104004054 | `docs/arquitectura/integracion_fase8/migraciones/20261103235409_di36_dentalia_03_rpc_clinicos.sql` | `c32fb15e0d7e774d322a1fcf019a5b35d1317ce8b9ba43895d028fe5f36f4eb9` |
| 20261104004101 | `docs/arquitectura/integracion_fase8/migraciones/20261103235411_di36_dentalia_04_workspace.sql` | `12cdef6a52dd03821a53aa295ead67b6cf39f7c97ad1f5ad0b6a0d6f176156ad` |

`docs/arquitectura/integracion_fase8/EJECUCION_MIGRACIONES_REMOTAS.json`
registra esa correspondencia y declara que el contenido aplicado fue idéntico.
No se localizaron archivos Git para `20261025150315` ni `20261025150507`.

Los cuatro SQL DI-36 contienen guardas de destino, aprobación y huella del
esquema previo para impedir su ejecución fuera del contexto aprobado. Copiarlos
sin más a `supabase/migrations` no permite reconstrucción local y puede ocultar
deriva. El siguiente paso seguro es una extracción remota **solo de lectura**
de `supabase_migrations.schema_migrations.statements` para las seis versiones
faltantes, revisión de secretos/datos/DDL privilegiado y comparación hash a
hash antes de versionar los originales con su versión remota.

## Hallazgos de DI-172

La migración define `oral_care_routine_plans`,
`oral_care_routine_activities` y `patient_routine_completions`. Sus controles
versionados incluyen:

- FK compuesto que evita asociar una actividad a un plan distinto, unicidad diaria
  por paciente/actividad y un índice de historial por paciente.
- RLS habilitado en las tres tablas, con lectura/escritura limitada a pacientes
  activos mediante `app_metadata` y `auth.uid()`.
- Fecha de finalización calculada con `America/Lima` y `upsert` seguro por la
  restricción `patient_routine_completions_once_per_day`.
- Restricción para planes publicados y vigentes, incluida la versión vigente del
  catálogo.

Falta ejecutar esas garantías con dos identidades reales de prueba y verificar el
comportamiento tras suspensión o cambio de rol; no se afirma esa validación sin la
base aislada.

## Diseño pendiente de validación remota

El orden propuesto para archivos independientes es:

1. DI-172 original (`20261116090000_di172_rutinas.sql`).
2. `dentist_services`: FK y propiedad confirmadas contra `dentists` y Auth; RLS de
   lectura pública solo para perfiles activos/publicados y gestión del propietario.
3. `smile_v17_storage`: consentimientos separados, resultados inmutables desde el
   cliente, RLS de propietario y bucket privado creado mediante Storage Admin.
4. `premium_subscriptions`: independiente de `payments`, escritura exclusiva de
   webhook de servidor e idempotencia por evento Stripe.
5. `smile_analysis_access_grants`: autorización por análisis y odontólogo,
   expiración/revocación y auditoría; sin herencia de cita, rol o pago.

Antes de escribir los SQL se debe confirmar en remoto: columnas y FKs de `dentists`,
políticas de `dental_photos`/`patient_consents`, grants Data API, buckets, funciones,
triggers e índices existentes. Toda tabla `public` debe tener RLS y políticas con
predicado de propiedad; no se usarán `user_metadata` ni roles por sí solos para
autorizar.

## Validación local y bloqueo reproducible

La validación se ejecutó con Supabase CLI 3.2.0 y Docker Engine 29.9.3, sin
proyecto vinculado. `supabase start` creó una base vacía y aplicó
`20261103012414_di151_roles_auditoria_atomica.sql`; falló al aplicar
`20261105210643_add_dentist_locations_and_reviews.sql` porque
`public.dentists` no existe (`SQLSTATE 42P01`). La CLI eliminó los contenedores,
red y volumen locales tras el fallo, por lo que no quedó estado parcial.

Existe `supabase/tests/fixtures/directorio-local-base.sql`, pero es un esquema
sintético desechable para pruebas y no una migración base: crea objetos mínimos
de `auth`, `clinical` y `public` que no representan una instalación Supabase
real. No debe promoverse como migración ni aplicarse a remoto.

El conector de Supabase remoto no inicia, por lo que tampoco fue posible
comparar el esquema alojado en modo solo lectura. Hasta que se incorpore o se
recupere la migración base que crea `dentists` y `clinical.*`, no es seguro
aplicar DI-172, DI-131, Smile, Premium ni grants desde una base limpia.

Por estos motivos no se crearon buckets ni tablas nuevas, no se generaron
`database.types.ts` y no se declararon pruebas RLS o Storage como aprobadas.

## Siguiente ejecución controlada

1. Restaurar acceso de solo lectura al proyecto y tomar un snapshot de metadatos,
   sin datos de pacientes.
2. Instalar/pinchar Supabase CLI compatible y arrancar el stack local, o crear una
   rama de desarrollo solo tras confirmar su coste.
3. Aplicar las migraciones en el orden anterior desde una base limpia.
4. Ejecutar pruebas con dos pacientes y dos odontólogos, revocación, expiración,
   suspensión, upsert diario y webhooks duplicados/desordenados.
5. Ejecutar asesores de seguridad, generar tipos desde el esquema validado y abrir
   PRs separados por funcionalidad.

## Intento de lectura remota para recuperación

El 16 de noviembre se intentó una única consulta con `supabase db query`, usando
`--remote vwmdknzjyvmsdqpepykz --read-only` y limitada a las seis versiones
faltantes. La CLI 3.2.0 la rechazó antes de enviar SQL con
`DbQueryLoginRequiredError`: no hay sesión ni `SUPABASE_ACCESS_TOKEN` en este
entorno. No se usó `link`, `push`, `repair`, `reset --linked` ni ninguna
operación de escritura remota.

La recuperación de octubre y la comparación directa de `statements` de DI-36
requieren una sesión con permiso `database_read` o una exportación de solo
lectura que entregue el responsable. Hasta entonces no se versionarán
reconstrucciones ni se declarará una reconstrucción local fiel.

Actualización posterior: la CLI local reconoce un token de perfil, pero
`supabase whoami --debug` falla al solicitar `GET /v1/profile` con
`WhoamiNetworkError`/`TransportError`. `api.supabase.com` y `mcp.supabase.com`
responden HTTP 401 cuando se consultan sin credenciales, por lo que la red está
disponible; el bloqueo está en el transporte de la CLI. No se imprimió,
extrajo, sustituyó ni revocó el token, y no se ejecutó SQL remoto.

## Reconstrucción tras recuperar octubre

Las migraciones `20261025150315_dentaia_mvp_independent_modules.sql` y
`20261025150507_allow_photo_owner_cleanup_after_consent_revocation.sql` se
incorporaron con las versiones remotas y se ejecutaron correctamente en Docker
local. La primera crea únicamente los cuatro perfiles explícitamente ficticios
del directorio y el bucket privado `dental-photos`; la revisión manual no
encontró secretos, credenciales, fotografías ni datos de pacientes o pagos.

La reconstrucción avanzó también por DI-151 y se detuvo en
`20261105210643_add_dentist_locations_and_reviews.sql` con `SQLSTATE 3F000`:
`clinical.clinics` no existe. Esto confirma el orden esperado: DI-36 Modelo
clínico debe ejecutarse antes de las ubicaciones. La CLI limpió los contenedores,
volumen y red locales al fallar, por lo que no persiste estado parcial.

No se creó un sustituto de `clinical` ni se debilitó ninguna guarda. Falta
versionar las cuatro DI-36 originales y una adaptación exclusivamente local de
sus guardas de destino, verificable y separada del SQL de producción.

## Ensayo de base QA independiente

Se inició el stack Docker local con las migraciones automáticas desactivadas,
se creó `dentaia_arch_qa_fase8` y se aplicó el comentario exacto
`DENTAIA_PHASE8_SYNTHETIC_ONLY`. La base adicional no hereda los esquemas
internos que Supabase inicializa únicamente en `postgres`: la primera migración
base falló con `schema "auth" does not exist` y la segunda con
`schema "storage" does not exist`. No se crearon mocks, esquemas falsos ni
adaptaciones de DI-36. La base QA parcial fue eliminada y el stack local se
detuvo; `db.migrations.enabled` fue restaurado a `true`.

Esto demuestra que una base adicional dentro del mismo contenedor no es una
réplica Supabase válida. Para ejecutar DI-36 sin debilitar sus guardas se
requiere un stack Supabase cuyo `db` inicial sea `dentaia_arch_qa_fase8` y cuyo
bootstrap de Auth/Storage se ejecute en esa misma base, o una clonación
verificable del catálogo local antes de arrancar los servicios. La CLI estándar
3.2.0 no ofrece ese cambio de base inicial en `config.toml`.

## Harness DI-36 local (validacion reproducible)

El harness `scripts/supabase/run-di36-local-qa.ps1` ejecuta solo contra el
contenedor local `supabase_db_DentaIA`, verifica su red Docker local y calcula
los cuatro SHA-256 de las fuentes originales. Usa un arreglo explicito, no una
tabla hash, en este orden: Administracion, Modelo clinico, RPC clinicos y
Workspace. Cada invocacion de `psql` usa `ON_ERROR_STOP=1`, comprueba su codigo
de salida y conserva copias adaptadas y logs temporales si falla.

La unica adaptacion, fuera de `supabase/migrations`, reemplaza la rama de
identificacion de destino para exigir en la base local `postgres` el comentario
`DENTAIA_PHASE8_SYNTHETIC_ONLY` y la GUC
`dentaia.integration_approval=fase8_local_simulation`. No modifica las fuentes
originales, el fingerprint de `public`, DDL, RLS, ACL, triggers ni funciones.

El 16 de noviembre se elimino el volumen Docker local, se inicio un stack
nuevo, se aplicaron las dos migraciones base de octubre y se ejecutaron las
cuatro DI-36 con el harness. Las cuatro finalizaron con codigo 0. Se verifico:

- `clinical` (11 tablas con RLS), `clinical_service` y `dentaia_admin` (3
  tablas con RLS) existen.
- `clinical` contiene 21 claves foraneas y 17 triggers no internos;
  `dentaia_admin` contiene un trigger no interno.
- Hay 9 funciones en `clinical` (ninguna `SECURITY DEFINER`), 12 en
  `clinical_service` (6 `SECURITY DEFINER`) y 4 en `dentaia_admin` (1
  `SECURITY DEFINER`).
- Los roles `anon` y `authenticated` no tienen `SELECT` sobre
  `clinical.clinics`, y `authenticated` no tiene `USAGE` sobre el esquema
  `clinical`.

Una ejecucion anterior no era limpia: el volumen local conservaba una aplicacion
parcial y Modelo clinico se detuvo por `CLINICAL_SCHEMA_ALREADY_EXISTS`. El
problema no correspondia a una dependencia de Administracion ni a una deriva
del fingerprint. Tras limpiar el volumen, `PUBLIC_SCHEMA_DRIFT_ABORT` no se
reprodujo. No se aplicaron migraciones posteriores ni se modifico Supabase
remoto.

## Cierre local de DI-151, DI-36 y DI-172

`20261103012414_di151_roles_auditoria_atomica.sql` y la fuente original
DI-36 Administracion crean los mismos objetos funcionales de `dentaia_admin`:
tres tablas, las funciones de roles, el trigger de auditoria y la funcion
publica controlada. El diff solamente incorpora a DI-36 las guardas de destino,
aprobacion y fingerprint, junto con diferencias de formato. DI-151 no aporta
un cambio posterior independiente.

Por ello, el harness QA reconstruye con DI-36 Administracion y excluye DI-151
solo de ese ensayo local. Los dos SQL historicos permanecen intactos y no se
usan `IF NOT EXISTS` ni reparaciones de historial. La evidencia remota ya
recuperada registra DI-36 Administracion con version `20261104004040`; no
registra DI-151 entre las once migraciones del proyecto remoto.

Sobre un volumen Docker eliminado y recreado se aplicaron, en este orden: las
dos migraciones de octubre, DI-36 mediante el harness, ubicaciones y resenas,
workflows administrativos, ubicaciones demo, payments y la migracion original
DI-172 leida desde `origin/feature/DI-172-rutinas`. Todas terminaron con salida
0. No se escribio en un proyecto remoto.

La prueba pgTAP original `di172_rutinas_rls.sql` termino con `1..45` y salida
0 al ejecutarse como `supabase_admin` dentro del Docker local. El rol local
denominado `postgres` no es superusuario (`is_superuser=off`), por lo que el
preflight intencional de la prueba lo rechaza; `supabase_admin` es el operador
superusuario local equivalente. Se verificaron RLS, dos pacientes, lectura
ajena denegada, insercion propia, idempotencia con `ON CONFLICT DO NOTHING`,
fechas de America/Lima, vigencia de planes, cuenta sin rol paciente y anonimo.

## DI-131 dentist_services

La migracion independiente `20261117041157_dentist_services.sql` crea el
catalogo publico `public.dentist_services`. La lectura publica queda limitada a
servicios activos. La administracion se limita a una cuenta profesional con
`clinical.professional_accounts.status = 'verified'` y `dentist_id` asociado.
No se concede lectura de `clinical`: una funcion `SECURITY DEFINER` estrecha en
`clinical_service` evalua exclusivamente esa relacion y solo es ejecutable por
`authenticated`.

`supabase/tests/di131_dentist_services_rls.sql` paso `1..9` en Docker local:
visitante solo lee activos; dos odontologos sinteticos quedan aislados; el
propietario verificado crea su servicio; y una cuenta pendiente no puede
escribir. Angie debe consumir `dentist_services` como catalogo, sin incorporar
una segunda tabla ni dar por sentado que todo odontologo autenticado es
propietario verificado.

## Reconstruccion integral local para PR #75

Se completo una reconstruccion limpia de QA con Supabase CLI 3.2.0 y Docker
local, sin proyecto vinculado ni comandos de escritura remota. El orden
validado fue: migraciones de octubre; DI-36 Administracion, Modelo clinico,
RPC clinicos y Workspace mediante `run-di36-local-qa.ps1`; ubicaciones y
resenas; workflows; demo locations; payments; DI-172 desde
`origin/feature/DI-172-rutinas`; y finalmente DI-131, Smile, Premium y
`payments_failed_status`.

DI-151 se omitio exclusivamente en esta reconstruccion local porque duplica
funcionalmente DI-36 Administracion. No se modifico ni elimino ningun SQL
historico, ni se alteraron sus hashes, guards, RLS, ACL, funciones o triggers.
DI-172 se uso como dependencia externa temporal de QA; su SQL conserva el
SHA-256 `f21a6050bd8fea9d6dd5a2a49cd5422e98c35f700c3336e22203f56b16f88795`,
no se copio a esta rama y no se cambio la rama de Anelis.

Las suites pgTAP terminaron correctamente: DI-172 45, DI-131 9, Smile 7,
`payments_failed_status` 3 y Premium RLS 6, para 70 aserciones. Se verifico
RLS en las tablas reconstruidas y que `payments_status_check` admite `failed`.
Las pruebas DI-172 se ejecutaron como `supabase_admin` dentro del contenedor
local; el rol `postgres` local no supera el preflight de superusuario de esa
suite.

Los tipos TypeScript se generaron desde el esquema local. La comparacion
encontro inicialmente que faltaba `dentist_services` en
`src/lib/supabase/database.types.ts`; se agrego su contrato `Row`, `Insert`,
`Update` y FK. Despues, las 16 tablas de esta rama coincidieron en nombres y
columnas con la generacion local. Las otras tres tablas generadas corresponden
exclusivamente a DI-172 y se excluyen del contrato de esta rama mientras siga
siendo una dependencia externa.

El historial remoto de Supabase no se consulto ni modifico en esta ejecucion;
el stack no estaba vinculado a un proyecto. La reconstruccion local no autoriza
Production: sigue pendiente verificar el historial remoto con acceso de solo
lectura, aprobar el orden de despliegue y ejecutar una ventana autorizada. Las
pruebas de firma, Checkout y webhook real con Stripe Sandbox no se ejecutaron
en esta reconstruccion.
