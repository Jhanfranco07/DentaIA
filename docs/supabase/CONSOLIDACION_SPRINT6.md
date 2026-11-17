# Consolidacion Supabase Sprint 6

## Estado actual de Production e integracion (17-11-2026)

El responsable confirmo mediante consulta directa que Production registra las
cinco versiones indicadas y que sus `statements` coinciden exactamente con el
SQL local. Esta ejecucion no pudo volver a leer Production desde la CLI; el
renombre local se basa en esa confirmacion. No se ejecutaron migraciones ni se
modifico `supabase_migrations.schema_migrations`.

| Archivo local alineado | Version/name en Production |
| --- | --- |
| `20261117150440_di172_rutinas_20261116090000.sql` | `20261117150440` / `di172_rutinas_20261116090000` |
| `20261117150451_dentist_services_20261117041157.sql` | `20261117150451` / `dentist_services_20261117041157` |
| `20261117150501_smile_analysis_history_20261117042645.sql` | `20261117150501` / `smile_analysis_history_20261117042645` |
| `20261117150504_premium_subscriptions_20261117042647.sql` | `20261117150504` / `premium_subscriptions_20261117042647` |
| `20261117150510_payments_failed_status_20261117050000.sql` | `20261117150510` / `payments_failed_status_20261117050000` |

La verificacion local comparo los blobs Git de los cinco archivos antes y
despues del renombre; los cinco contenidos permanecen identicos.

### Transicion segura para otros entornos

Los cinco archivos se renombraron sin editar su SQL. Production ya registra los
nuevos identificadores, por lo que no requiere reparacion ni reejecucion. Para
un entorno nuevo, el runner de migraciones aplicara cada archivo una sola vez
con el identificador alineado, siempre que la cadena base completa del
repositorio este disponible.

Un entorno local o QA existente puede conservar los cinco identificadores
originales. Antes de usar `db push`, consultar solo su historial de migraciones
y comparar el SQL aplicado con cada archivo; obtener un respaldo recuperable y
confirmar que ese destino no es Production. En una ventana controlada, marcar
primero como aplicados los cinco identificadores nuevos y luego como revertidos
los cinco antiguos, usando `supabase migration repair` con el destino QA/local
explicito. No ejecutar `db push` entre ambos pasos. Finalmente, comprobar que
`supabase migration list` muestra solo los identificadores canonicos como
aplicados. Esta reparacion es solo una estrategia documentada: no se ejecuto
en QA ni Production en esta tarea y requiere aprobacion del responsable del
entorno.

Para un QA remoto, una vez comprobados el respaldo y el `QA_PROJECT_REF`, la
secuencia prevista es:

```powershell
supabase migration repair --remote="QA_PROJECT_REF" --status applied 20261117150440 20261117150451 20261117150501 20261117150504 20261117150510
supabase migration repair --remote="QA_PROJECT_REF" --status reverted 20261116090000 20261117041157 20261117042645 20261117042647 20261117050000
```

Sustituir el marcador solo por el ref verificado de QA; nunca usar el ref de
Production. Para un entorno local se omite `--remote`. Si cualquiera de las
comprobaciones falla, detenerse sin ejecutar `db push`.

La cadena base completa aun tiene brechas historicas documentadas en esta
auditoria (versiones de octubre y DI-36); por tanto, no se afirma que un
entorno vacio pueda reconstruir todo Production hasta recuperar y validar esas
migraciones por separado. Nunca ejecutar `db push`, `db reset` o `migration
repair` contra Production como parte de esta reconciliacion.

Segun el mismo reporte, las nueve tablas de rutinas (3), servicios (1), Smile
(3) y Premium/webhooks (2) existen con RLS; tambien existen las cinco politicas
de `dentist_services`, el bucket privado Smile de 8 MiB y la restriccion de
pagos que admite `failed`. Estos objetos no se volvieron a consultar.

La rama `integration/pr71-pr74-compat-20261117` integra los cambios de PR #71
y PR #74 sobre la base de PR #75 y esta publicada como Draft PR #76 hacia
`main`. El conflicto de `database.types.ts` se resolvio conservando ambas
funcionalidades. TypeScript, unitarias, build, `npm audit` y 45 pruebas pgTAP
de DI-172 pasaron en local; estas ultimas corrieron en un proyecto Supabase
temporal y aislado, no verifican Production. Los checks de GitHub estaban
verdes antes del cambio de nombres; el nuevo commit debe volver a ejecutarlos.

### Credenciales e historial Git

Se saneo solo `.env.example`: conserva los nombres de variables del template y
usa placeholders descriptivos; no se modifico `.env.local` ni otros archivos
privados. El analisis Gitleaks de todos los refs locales y la revision de 17
versiones historicas de `.env.example` encontraron:

- `562ce9a888d5`: valor no vacio con formato de clave secreta Supabase en
  `DENTAIA_SUPABASE_ADMIN_READ_SECRET`. No aparece en refs remotos y GitHub no
  encontro el objeto del commit. Si la clave sigue activa, crear otra en
  Supabase Dashboard > Project Settings > API Keys > Secret keys, actualizar
  el secret del servidor y revocar la anterior.
- `7e906d13fde7`: clave API Stripe de modo test y secreto de firma de webhook.
  El JWT service-role asociado tiene issuer demo/local, no Production. El
  commit tampoco aparece en refs remotos ni GitHub encontro el objeto. Si los
  secretos Stripe siguen activos, rotar la clave en modo Test desde Developers
  > API keys y el secreto en Developers > Webhooks > endpoint > Roll secret;
  actualizar `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` en el secret store del
  servidor y redeplegar.
- `07383d9ab0e7`: Gitleaks marco una cadena generica en
  `services/dental-vision/tests/test_evaluation.py`; el valor es un fixture
  estatico usado por `TestClient`/`monkeypatch`, sin prefijo de proveedor
  reconocido. No hay evidencia de una credencial de proveedor en ese hallazgo.

Los dos commits con credenciales de proveedor no son alcanzables desde refs
remotos y la consulta de GitHub no encontro sus objetos; no hay evidencia de
que se publicaran, aunque no se puede descartar que se hayan compartido por
otro medio o que refs remotos anteriores fueran eliminadas. Las credenciales
que se agregaron despues al working tree de `.env.example` no estaban
comprometidas ni se subieron; se reemplazaron sin usarlas.

## Inventario historico de QA local

| Dominio | Esquema o tabla | Estado comprobado |
| --- | --- | --- |
| Identidad y paciente | `public.profiles`, `patient_consents`, `dental_photos` | Base de octubre; RLS y bucket `dental-photos` ya existentes. |
| Directorio | `public.dentists`, ubicaciones y reseñas | Aplicado en reconstruccion local. |
| Servicios | `public.dentist_services` | DI-131; 9 pruebas pgTAP aprobadas. |
| Historia clinica | `clinical.*`, `clinical_service`, `dentaia_admin` | DI-36; permisos por concesion, no por cita, pago o rol aislado. |
| Rutinas | tres tablas `oral_care_routine_*` | Migración DI-172 y 45 aserciones pgTAP aprobadas en proyecto local temporal aislado; no verifica el esquema de Production. |
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
ejecucion. El candidato actual incorpora las tres tablas y tipos de DI-172. La
coincidencia exacta del SQL local con Production fue confirmada directamente
por el responsable; esta ejecucion alinea los nombres sin editar el SQL.

La prueba de firma, Checkout y webhook real de Stripe Sandbox sigue pendiente.
Durante la reconstruccion anterior no se consulto ni modifico el historial
remoto; posteriormente, el responsable confirmo la comparacion directa del SQL
efectivo de Production. Esta tarea tampoco escribio en Production.

## Integracion de ramas

| Modulo | Responsable | Migracion / contrato | Estado y requisito |
| --- | --- | --- | --- |
| Rutinas | Anelis | `20261117150440_di172_rutinas_20261116090000.sql` | Integrado desde PR #71 en Draft #76. SQL/version cotejados por el responsable; no aplicar de nuevo. |
| Servicios | Angie | `20261117150451_dentist_services_20261117041157.sql` | Integrado desde PR #74 sobre la base incluida por PR #75 en Draft #76. UI lista activos para visitantes y administra por profesional verificado vinculado. |
| Stripe | Stephan | `payments`, `premium_subscriptions` | PR #73 integra Checkout `payment`, webhook firmado e idempotencia en `payments`; el pago unico no crea una suscripcion ni activa Premium. Recurrencia pendiente de definicion comercial. |
| Smile V17 | Jhan | `20261117150501_smile_analysis_history_20261117042645.sql` | Requiere BFF server-only para persistencia y URLs firmadas; Basic actual sigue sin persistencia. |
| Historia clinica | Equipo | DI-36 | No mezclar con Smile; acceso sigue sujeto a grants clinicos independientes. |

## Guia de conexion

| Consumidor | Contrato disponible | Operaciones permitidas | Pendiente de integracion |
| --- | --- | --- | --- |
| Paciente Smile | `smile-history-server.ts`, `smile_analysis_consents`, `smile_analyses` | Adaptador server-only con token de usuario: aceptar/revocar consentimiento, listar analisis propios y conceder/revocar grants mediante RPC | No hay rutas API conectadas al adaptador; falta persistir resultados y gestionar carga/eliminacion de objetos privados. |
| Odontologo | RLS de `smile_analyses` y grant por analisis | Solo leer analisis con grant activo, profesional verificado y consentimiento vigente | BFF que genere URL firmada corta tras reevaluar el grant; Storage no entrega objetos directamente. |
| Rutinas (Anelis) | DI-172 y sus tres tablas | Paciente autenticado con rol paciente; marcas propias por dia Lima | Frontend y contrato integrados; RLS aprobada con 45 aserciones pgTAP locales. Incluido en Draft #76. |
| Directorio/servicios (Angie) | `dentist_services` | Visitante lee activos; profesional verificado administra solo su `dentist_id` | Consulta RLS integrada en Draft #76. |
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

No aplicar de nuevo ninguna de las cinco migraciones: Production ya registra
las versiones alineadas y el responsable confirmo la coincidencia exacta de
`statements` con el SQL local. Esta ejecucion no modifico el historial remoto.
Para una divergencia futura de SQL, usar una migracion correctiva hacia delante;
no reescribir los archivos aplicados. La transicion de entornos locales/QA con
IDs antiguos esta documentada arriba y requiere respaldo, destino confirmado y
aprobacion; nunca usar `db push`, `migration repair` ni `db reset --linked`
contra Production para reconciliar identificadores.

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
