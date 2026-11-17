# Consolidacion Supabase Sprint 6

## Estado actual de Production e integracion (17-11-2026)

El estado de Production siguiente proviene del reporte del responsable y no se
pudo volver a consultar desde esta ejecucion. No se ejecutaron migraciones ni
se modifico `supabase_migrations.schema_migrations`.

| Migracion local | Version/name reportados en Production |
| --- | --- |
| `20261116090000_di172_rutinas.sql` | `20261117150440` / `di172_rutinas_20261116090000` |
| `20261117041157_dentist_services.sql` | `20261117150451` / `dentist_services_20261117041157` |
| `20261117042645_smile_analysis_history.sql` | `20261117150501` / `smile_analysis_history_20261117042645` |
| `20261117042647_premium_subscriptions.sql` | `20261117150504` / `premium_subscriptions_20261117042647` |
| `20261117050000_payments_failed_status.sql` | `20261117150510` / `payments_failed_status_20261117050000` |

La CLI enlazada al proyecto no pudo leer el historial: `supabase migration
list` fallo con `DbConfigIpv6Error` (la red actual no admite IPv6). No hay una
integracion Supabase de solo lectura disponible en esta sesion ni se verifico
un respaldo recuperable. Por ello, las versiones/SQL reportados aun no se
compararon con `schema_migrations.statements`; no renombrar ni reparar
migraciones hasta obtener esa lectura. No ejecutar `db push`, `db reset` ni
`migration repair` contra Production. Si los statements no coinciden con los
archivos, detenerse y proponer una migracion correctiva hacia delante, sin
reescribir el SQL aplicado.

Segun el mismo reporte, las nueve tablas de rutinas (3), servicios (1), Smile
(3) y Premium/webhooks (2) existen con RLS; tambien existen las cinco politicas
de `dentist_services`, el bucket privado Smile de 8 MiB y la restriccion de
pagos que admite `failed`. Estos objetos no se volvieron a consultar.

El candidato local `integration/pr71-pr74-compat-20261117` integra los cambios
de PR #71 y PR #74 sobre la base de PR #75. No se ha publicado ni fusionado a
GitHub; el conflicto de `database.types.ts` se resolvio conservando ambas
funcionalidades. Los checks locales actuales pasan TypeScript, unitarias,
build y `npm audit`; la prueba pgTAP de DI-172 no pudo iniciarse porque el
arranque aislado de Supabase local quedo bloqueado durante la descarga de la
imagen de PostgreSQL. Esto no es una aprobacion de RLS.

## Inventario historico de QA local

| Dominio | Esquema o tabla | Estado comprobado |
| --- | --- | --- |
| Identidad y paciente | `public.profiles`, `patient_consents`, `dental_photos` | Base de octubre; RLS y bucket `dental-photos` ya existentes. |
| Directorio | `public.dentists`, ubicaciones y reseñas | Aplicado en reconstruccion local. |
| Servicios | `public.dentist_services` | DI-131; 9 pruebas pgTAP aprobadas. |
| Historia clinica | `clinical.*`, `clinical_service`, `dentaia_admin` | DI-36; permisos por concesion, no por cita, pago o rol aislado. |
| Rutinas | tres tablas `oral_care_routine_*` | Evidencia historica de QA documenta 45 aserciones pgTAP; no se reejecutaron en este candidato. El codigo y la migracion DI-172 ya estan integrados en el candidato local. |
| Pagos | `public.payments` | Registra pagos Stripe; no acredita suscripcion recurrente. |
| Suscripciones | `premium_subscriptions`, `stripe_webhook_events` | RLS sin politica cliente; escritura destinada al backend. Evidencia historica registra pruebas pgTAP, no reejecutadas en este candidato. |
| Smile | consentimientos, analisis y grants | RLS con acceso por propietario/concesion. Evidencia historica registra 7 pruebas pgTAP, no reejecutadas en este candidato. |

Tener una tabla no acredita su API, UI ni proveedor externo. La reconstruccion y
las pruebas descritas son SQL local con datos sinteticos.

## Smile y privacidad

`smile_analysis_consents` es independiente de `patient_consents`. Una
revocacion invalida los grants activos. `smile_analyses` conserva el resultado
tecnico compatible con el contrato V17, explicacion educativa y metadatos de
objetos, sin cambiar el algoritmo. `smile_analysis_access_grants` autoriza un
analisis concreto a un profesional verificado y vence o puede revocarse.

El bucket privado `smile-analysis-private` acepta solo imagenes JPEG, PNG o
WebP de hasta 8 MiB y las organiza por prefijo del UUID propietario. Storage no
concede lectura a profesionales; un futuro BFF debe volver a comprobar el grant
vigente antes de producir una URL firmada. Borrar una fila de analisis no borra
un objeto: esa operacion queda reservada al servidor para eliminar ambos.

## Basic y Premium

El catalogo `src/features/planes/catalogo.ts` deja disponible
`smile_yellow_teeth_basic` para Basic. Las capacidades Premium futuras quedan
expresamente deshabilitadas aunque el plan sea Premium. `effectivePlan` solo
acepta una suscripcion activa y vigente que haya sido obtenida por el servidor;
nunca acepta plan desde HTTP ni metadata editable.

`payments` no se reutiliza como suscripcion. Aunque `premium_subscriptions` y
`stripe_webhook_events` figuran como aplicadas en el reporte de Production, la
integracion recurrente de la aplicacion sigue pendiente; el Checkout actual es
de pago unico y su webhook firmado solo
persiste en `payments`. No crea suscripciones ni habilita Premium. Checkout,
retorno del navegador, pago pendiente, fallido o evento no procesado no
habilitan Premium. No se implemento Stripe Live ni se activo ninguna capacidad
Premium.

`premium_subscriptions_rls.sql` cubre aislamiento entre cuentas, denegacion de
INSERT/UPDATE/DELETE por clientes y rechazo de eventos Stripe duplicados. La
version extendida y `payments_failed_status.sql` pasaron localmente con pgTAP
(9 aserciones). Junto con DI-172 (45), DI-131 (9) y Smile (7), se aprobaron 70
aserciones pgTAP en la reconstruccion local completa.

La reconstruccion local completa y la comparacion de tipos descritas arriba son
evidencia historica de QA, no una verificacion del esquema de Production en esta
ejecucion. El candidato actual incorpora las tres tablas y tipos de DI-172.
Los SQL historicos no se modificaron; la conciliacion entre nombres locales y
versiones remotas sigue pendiente de comparar los statements de Production.

La prueba de firma, Checkout y webhook real de Stripe Sandbox sigue pendiente.
No se consulto ni modifico el historial remoto durante la reconstruccion; la
comparacion de Production y cualquier despliegue requieren una autorizacion y
una ventana independiente.

## Integracion de ramas

| Modulo | Responsable | Migracion / contrato | Estado y requisito |
| --- | --- | --- | --- |
| Rutinas | Anelis | `20261116090000_di172_rutinas.sql` | Integrado localmente desde PR #71. Falta CI en el candidato y cotejo de contenido/version remota; no aplicar de nuevo. |
| Servicios | Angie | `20261117041157_dentist_services.sql` | Integrado localmente desde PR #74 sobre la base incluida por PR #75. UI lista activos para visitantes y administra por profesional verificado vinculado; falta CI del candidato. |
| Stripe | Stephan | `payments`, `premium_subscriptions` | PR #73 integra Checkout `payment`, webhook firmado e idempotencia en `payments`; el pago unico no crea una suscripcion ni activa Premium. Recurrencia pendiente de definicion comercial. |
| Smile V17 | Jhan | `20261117042645_smile_analysis_history.sql` | Requiere BFF server-only para persistencia y URLs firmadas; Basic actual sigue sin persistencia. |
| Historia clinica | Equipo | DI-36 | No mezclar con Smile; acceso sigue sujeto a grants clinicos independientes. |

## Guia de conexion

| Consumidor | Contrato disponible | Operaciones permitidas | Pendiente de integracion |
| --- | --- | --- | --- |
| Paciente Smile | `smile-history-server.ts`, `smile_analysis_consents`, `smile_analyses` | Adaptador server-only con token de usuario: aceptar/revocar consentimiento, listar analisis propios y conceder/revocar grants mediante RPC | No hay rutas API conectadas al adaptador; falta persistir resultados y gestionar carga/eliminacion de objetos privados. |
| Odontologo | RLS de `smile_analyses` y grant por analisis | Solo leer analisis con grant activo, profesional verificado y consentimiento vigente | BFF que genere URL firmada corta tras reevaluar el grant; Storage no entrega objetos directamente. |
| Rutinas (Anelis) | DI-172 y sus tres tablas | Paciente autenticado con rol paciente; marcas propias por dia Lima | Frontend y contrato integrados en el candidato local; RLS pgTAP pendiente de reejecucion en esta ejecucion. |
| Directorio/servicios (Angie) | `dentist_services` | Visitante lee activos; profesional verificado administra solo su `dentist_id` | Consulta RLS integrada en el candidato local; falta CI para el commit combinado. |
| Premium/Stripe (Stephan) | `premium_subscriptions`, `stripe_webhook_events`, `premium-server.ts` | Adaptador server-only deriva el plan desde la suscripcion RLS del usuario; ningun cliente escribe. PR #73 agrega Checkout de pago unico, webhook firmado, historial de `payments` y consulta server-side del plan. | No hay ciclo recurrente ni portal; `payments` no se convierte en suscripcion y ninguna funcion Premium futura se activa. |

Los endpoints existentes `POST /api/desarrollo/dentaia-smile` y
`POST /api/desarrollo/dentaia-smile/explain` siguen siendo Basic:
autenticacion, limites de uso y V17 no se modificaron. No existen aun endpoints
de historial/consentimiento Smile, carga o eliminacion de objetos, lectura
profesional con URL firmada, ni ciclo recurrente/portal de suscripciones.
Checkout y webhook de pago unico no escriben `premium_subscriptions`.
No deben usarse los endpoints Basic para guardar, compartir o conceder Premium.

Siguen deshabilitadas las funciones Premium de historial, comparacion, compartir
con odontologo y analisis avanzado; sus capacidades permanecen con
`implemented: false` en `src/features/planes/catalogo.ts`. El adaptador de plan
no habilita por si mismo estas funciones ni sustituye la autorizacion de cada
endpoint.

## Orden de aplicacion remoto

No aplicar ninguna de las cinco migraciones de la tabla de estado mientras el
reporte indique que Production ya las contiene. El siguiente paso es una lectura
autorizada de solo lectura de `version`, `name` y `statements` en
`supabase_migrations.schema_migrations`, seguida de comparacion con cada archivo
local. Para cualquier operacion que vaya a cambiar el historial remoto, exigir
antes un respaldo recuperable y una estrategia aprobada; si el SQL no coincide
o no puede verificarse, detenerse. La conciliacion local no debe cambiar el SQL
ni crear duplicados. No usar `db push`, `migration repair` ni `db reset
--linked` como mecanismo de recuperacion.

## Produccion

En esta ejecucion no se aplico SQL ni se modifico Production. La proteccion de
contrasenas filtradas se reporta desactivada; se recomienda habilitarla en Auth
tras autorizacion, sin cambiar esa configuracion desde este candidato. Los RPC
Smile `grant_smile_analysis_access`, `revoke_smile_analysis_access` y
`revoke_smile_analysis_consent` estan intencionalmente disponibles a
`authenticated`: las definiciones revocan permisos generales, fijan
`search_path` vacio y limitan las escrituras por `auth.uid()`, propiedad,
consentimiento vigente y profesional verificado. `stripe_webhook_events` no
tiene politicas RLS para clientes y solo concede operaciones a `service_role`,
destinado al backend. Mantener ambas claves/configuraciones fuera del navegador.
