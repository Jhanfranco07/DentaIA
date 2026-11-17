# Consolidacion Supabase Sprint 6

## Inventario efectivo local

| Dominio | Esquema o tabla | Estado comprobado |
| --- | --- | --- |
| Identidad y paciente | `public.profiles`, `patient_consents`, `dental_photos` | Base de octubre; RLS y bucket `dental-photos` ya existentes. |
| Directorio | `public.dentists`, ubicaciones y reseñas | Aplicado en reconstruccion local. |
| Servicios | `public.dentist_services` | DI-131; 9 pruebas pgTAP aprobadas. |
| Historia clinica | `clinical.*`, `clinical_service`, `dentaia_admin` | DI-36; permisos por concesion, no por cita, pago o rol aislado. |
| Rutinas | tres tablas `oral_care_routine_*` | DI-172; 45 pruebas pgTAP aprobadas. |
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

`payments` no se reutiliza como suscripcion. `premium_subscriptions` representa
el estado Stripe recurrente y `stripe_webhook_events` es un ledger idempotente.
Solo un webhook cuya firma sea verificada por un endpoint server-only puede
escribir estas tablas. Checkout, retorno del navegador, pago pendiente, fallido
o evento no procesado no habilitan Premium. No se implemento Stripe Live ni se
activo ninguna capacidad Premium.

La prueba local `premium_subscriptions_rls.sql` aprobo tres controles: cada
paciente ve solo su suscripcion, el cliente no puede insertar una suscripcion y
el ledger rechaza un evento Stripe duplicado. Esto no sustituye una prueba de
firma, Checkout o webhook real de Stripe Sandbox.

## Integracion de ramas

| Modulo | Responsable | Migracion / contrato | Estado y requisito |
| --- | --- | --- | --- |
| Rutinas | Anelis | `20261116090000_di172_rutinas.sql` | Compatible. Ejecutar pgTAP como `supabase_admin` en Docker local; el rol local `postgres` no es superusuario. |
| Servicios | Angie | `20261117041157_dentist_services.sql` | Compatible. UI debe listar solo activos para visitantes y administrar por profesional verificado vinculado. |
| Stripe | Stephan | `payments`, `premium_subscriptions` | Requiere endpoint webhook con verificacion de firma y Sandbox; no esta acreditado por la migracion. |
| Smile V17 | Jhan | `20261117042645_smile_analysis_history.sql` | Requiere BFF server-only para persistencia y URLs firmadas; Basic actual sigue sin persistencia. |
| Historia clinica | Equipo | DI-36 | No mezclar con Smile; acceso sigue sujeto a grants clinicos independientes. |

## Produccion

No se aplicaron migraciones remotas. Antes de abrir un PR de despliegue: revisar
los SQL, tomar respaldo, confirmar las versiones remotas, ejecutar CI, configurar
secretos solo de servidor y preparar rollback de cada migracion. No ejecutar
`db push`, `migration repair` ni `db reset --linked`.
