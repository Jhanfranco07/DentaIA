# Consolidacion Supabase Sprint 6

## Inventario efectivo local

| Dominio | Esquema o tabla | Estado comprobado |
| --- | --- | --- |
| Identidad y paciente | `public.profiles`, `patient_consents`, `dental_photos` | Base de octubre; RLS y bucket `dental-photos` ya existentes. |
| Directorio | `public.dentists`, ubicaciones y reseñas | Aplicado en reconstruccion local. |
| Servicios | `public.dentist_services` | DI-131; 9 pruebas pgTAP aprobadas. |
| Historia clinica | `clinical.*`, `clinical_service`, `dentaia_admin` | DI-36; permisos por concesion, no por cita, pago o rol aislado. |
| Rutinas | tres tablas `oral_care_routine_*` | DI-172 se aplico solo en QA local desde la rama externa autorizada; 45 pruebas pgTAP aprobadas. No se incorpora a esta rama. |
| Pagos | `public.payments` | Registra pagos Stripe; no acredita suscripcion recurrente. |
| Suscripciones | `premium_subscriptions`, `stripe_webhook_events` | Nueva migracion; escritura exclusiva de servidor/webhook. |
| Smile | consentimientos, analisis y grants | Nueva migracion; 7 pruebas pgTAP aprobadas. |

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

`payments` no se reutiliza como suscripcion. `premium_subscriptions` y
`stripe_webhook_events` definen el esquema previsto para una futura integracion
recurrente; el Checkout actual es de pago unico y su webhook firmado solo
persiste en `payments`. No crea suscripciones ni habilita Premium. Checkout,
retorno del navegador, pago pendiente, fallido o evento no procesado no
habilitan Premium. No se implemento Stripe Live ni se activo ninguna capacidad
Premium.

`premium_subscriptions_rls.sql` cubre aislamiento entre cuentas, denegacion de
INSERT/UPDATE/DELETE por clientes y rechazo de eventos Stripe duplicados. La
version extendida y `payments_failed_status.sql` pasaron localmente con pgTAP
(9 aserciones). Junto con DI-172 (45), DI-131 (9) y Smile (7), se aprobaron 70
aserciones pgTAP en la reconstruccion local completa.

La reconstruccion local se completo con el procedimiento DI-36: octubre, DI-36,
ubicaciones/resenas, workflows, demo locations, payments, DI-172 externo y las
migraciones nuevas. DI-151 se excluyo solo de ese ensayo por duplicar
funcionalmente DI-36 Administracion; los SQL historicos no se alteraron. Los
tipos se generaron desde el esquema local y se compararon con
`database.types.ts`: coinciden todas las tablas incorporadas en esta rama,
incluidas `dentist_services`, Smile, pagos y Premium. Las tres tablas de DI-172
se excluyen deliberadamente del contrato comprometido porque esa migracion es
solo una dependencia externa de QA y no forma parte de esta rama. El harness,
las pruebas y el tipo de la migracion `payments.failed` se validaron localmente.

La prueba de firma, Checkout y webhook real de Stripe Sandbox sigue pendiente.
No se consulto ni modifico el historial remoto durante la reconstruccion; la
comparacion de Production y cualquier despliegue requieren una autorizacion y
una ventana independiente.

## Integracion de ramas

| Modulo | Responsable | Migracion / contrato | Estado y requisito |
| --- | --- | --- | --- |
| Rutinas | Anelis | `20261116090000_di172_rutinas.sql` (no incluido en esta rama) | Mantener como dependencia externa; incorporar y validar desde el trabajo de Anelis por separado. |
| Servicios | Angie | `20261117041157_dentist_services.sql` | Compatible. UI debe listar solo activos para visitantes y administrar por profesional verificado vinculado. |
| Stripe | Stephan | `payments`, `premium_subscriptions` | PR #73 integra Checkout `payment`, webhook firmado e idempotencia en `payments`; el pago unico no crea una suscripcion ni activa Premium. Recurrencia pendiente de definicion comercial. |
| Smile V17 | Jhan | `20261117042645_smile_analysis_history.sql` | Requiere BFF server-only para persistencia y URLs firmadas; Basic actual sigue sin persistencia. |
| Historia clinica | Equipo | DI-36 | No mezclar con Smile; acceso sigue sujeto a grants clinicos independientes. |

## Guia de conexion

| Consumidor | Contrato disponible | Operaciones permitidas | Pendiente de integracion |
| --- | --- | --- | --- |
| Paciente Smile | `smile-history-server.ts`, `smile_analysis_consents`, `smile_analyses` | Adaptador server-only con token de usuario: aceptar/revocar consentimiento, listar analisis propios y conceder/revocar grants mediante RPC | No hay rutas API conectadas al adaptador; falta persistir resultados y gestionar carga/eliminacion de objetos privados. |
| Odontologo | RLS de `smile_analyses` y grant por analisis | Solo leer analisis con grant activo, profesional verificado y consentimiento vigente | BFF que genere URL firmada corta tras reevaluar el grant; Storage no entrega objetos directamente. |
| Rutinas (Anelis) | DI-172 y sus tres tablas | Paciente activo, autenticado y con rol paciente; marcas propias por dia Lima | Integrar su frontend sin cambiar la migracion. |
| Directorio/servicios (Angie) | `dentist_services` | Visitante lee activos; profesional verificado administra solo su `dentist_id` | Sustituir el catalogo demo por consulta RLS cuando su PR se integre. |
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

El despliegue futuro no debe ejecutar las migraciones historicas que ya figuran
en `supabase_migrations.schema_migrations`. Primero comparar ese historial con
las versiones locales; despues aplicar, en una ventana controlada y una vez,
`20261117041157_dentist_services`, `20261117042645_smile_analysis_history` y
`20261117042647_premium_subscriptions` (una sola copia compartida por PR #72 y
PR #73), y `20261117050000_payments_failed_status` despues de la tabla
`payments`; omitir toda version ya registrada. Si rutinas forma parte del
alcance del despliegue, integrar primero `20261116090000_di172_rutinas` desde
PR #71 solo despues de su aprobacion y validacion local; no esta incluida en
esta rama ni se debe inferir o ejecutar desde este PR. Hasta resolver DI-172,
mantener rutinas fuera de cualquier despliegue de esta integracion.
Respaldar antes de aplicar, verificar buckets/politicas, regenerar tipos contra
el esquema remoto resultante y ejecutar las pruebas post-despliegue. No usar
`db push`, `migration repair` ni `db reset --linked` como mecanismo de
recuperacion.

## Produccion

No se aplicaron migraciones remotas. Antes de abrir un PR de despliegue: revisar
los SQL, tomar respaldo, confirmar las versiones remotas, ejecutar CI, configurar
secretos solo de servidor y preparar rollback de cada migracion. No ejecutar
`db push`, `migration repair` ni `db reset --linked`.
