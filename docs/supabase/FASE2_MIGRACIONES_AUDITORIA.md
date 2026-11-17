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
