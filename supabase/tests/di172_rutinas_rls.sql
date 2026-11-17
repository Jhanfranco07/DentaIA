-- Pruebas de políticas reales para DI-172.
-- Ejecutar solo en un proyecto Supabase local y desechable, después de aplicar
-- la migración DI-172. El test usa UUID/correos sintéticos y termina en ROLLBACK.
-- No apunta por sí solo a un servidor: el procedimiento obligatorio está en
-- docs/DI-172-validacion.md y usa `supabase test db --local` sin `link`.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

do $setup$
declare
  hoy date := (now() at time zone 'America/Lima')::date;
begin
  if current_setting('is_superuser') <> 'on' then
    raise exception 'DI172_TEST_REQUIRES_LOCAL_DB_OWNER';
  end if;

  perform set_config('di172.test.today', hoy::text, true);

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'di172-paciente-a@example.test', '', now(),
      '{"provider":"email","providers":["email"],"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}', '{}', now(), now()),
    ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'di172-paciente-b@example.test', '', now(),
      '{"provider":"email","providers":["email"],"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}', '{}', now(), now()),
    ('91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'di172-sin-rol@example.test', '', now(),
      '{"provider":"email","providers":["email"],"dentaia":{"version":"1","estado":"activo","roles":["odontologo"]}}', '{}', now(), now());

  insert into public.oral_care_routine_plans
    (id, plan_key, version, title, description, valid_from, valid_until, published)
  values
    ('92000000-0000-4000-8000-000000000001', 'di172-versionada', 1, 'Plan histórico DI-172', 'Fixture sintético', hoy - 30, null, true),
    ('92000000-0000-4000-8000-000000000002', 'di172-versionada', 2, 'Plan vigente DI-172', 'Fixture sintético', hoy, null, true),
    ('92000000-0000-4000-8000-000000000003', 'di172-futuro', 1, 'Plan futuro DI-172', 'Fixture sintético', hoy + 1, null, true),
    ('92000000-0000-4000-8000-000000000004', 'di172-vencido', 1, 'Plan vencido DI-172', 'Fixture sintético', hoy - 30, hoy - 1, true),
    ('92000000-0000-4000-8000-000000000005', 'di172-no-publicado', 1, 'Plan no publicado DI-172', 'Fixture sintético', hoy - 30, null, false);

  insert into public.oral_care_routine_activities
    (id, plan_id, activity_key, title, description, time_of_day, sort_order)
  values
    ('93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'historica', 'Actividad histórica', 'Fixture', 'morning', 1),
    ('93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'vigente', 'Actividad vigente', 'Fixture', 'morning', 1),
    ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', 'futura', 'Actividad futura', 'Fixture', 'morning', 1),
    ('93000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000004', 'vencida', 'Actividad vencida', 'Fixture', 'morning', 1),
    ('93000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000005', 'oculta', 'Actividad no publicada', 'Fixture', 'morning', 1);

  -- Una marca histórica de A se inserta con el rol dueño para preparar el
  -- escenario de lectura y borrado denegado; no persiste por el ROLLBACK.
  insert into public.patient_routine_completions
    (patient_id, plan_id, activity_id, completion_date, completed_at)
  values
    ('91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000001', hoy - 1, now() - interval '1 day');
end
$setup$;

select ok((select relrowsecurity from pg_class where oid = 'public.oral_care_routine_plans'::regclass), 'RLS está habilitado en el catálogo de planes');
select ok((select relrowsecurity from pg_class where oid = 'public.oral_care_routine_activities'::regclass), 'RLS está habilitado en el catálogo de actividades');
select ok((select relrowsecurity from pg_class where oid = 'public.patient_routine_completions'::regclass), 'RLS está habilitado en las marcas');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.patient_routine_completions'::regclass and conname = 'patient_routine_completions_once_per_day' and contype = 'u'), 'existe la restricción de unicidad diaria');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.patient_routine_completions'::regclass and conname = 'patient_routine_completions_activity_fk' and contype = 'f'), 'existe la FK compuesta plan/actividad');

-- Las dos marcas límite corresponden a la medianoche de Lima (UTC-05:00).
select is(
  (timestamptz '2026-11-17 04:59:59+00' at time zone 'America/Lima')::date,
  date '2026-11-16',
  '04:59:59 UTC sigue siendo el día anterior en America/Lima'
);
select is(
  (timestamptz '2026-11-17 05:00:00+00' at time zone 'America/Lima')::date,
  date '2026-11-17',
  '05:00:00 UTC inicia el nuevo día en America/Lima'
);

-- Paciente A: catálogo publicado, lectura propia, alta válida e idempotencia.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}}', true);
set local role authenticated;

select is((select count(*)::integer from public.oral_care_routine_plans where plan_key = 'general-preventive'), 1, 'paciente activo lee el plan general publicado');
select ok((select count(*) > 0 from public.oral_care_routine_activities where plan_id = '92000000-0000-4000-8000-000000000002'), 'paciente activo lee actividades publicadas');
select is((select count(*)::integer from public.oral_care_routine_plans where plan_key = 'di172-no-publicado'), 0, 'paciente no ve planes no publicados');
select is((select count(*)::integer from public.oral_care_routine_activities where plan_id = '92000000-0000-4000-8000-000000000005'), 0, 'paciente no ve actividades de planes no publicados');
select is((select count(*)::integer from public.patient_routine_completions), 1, 'paciente A solo lee su historial precargado');
select throws_ok(
  $$insert into public.oral_care_routine_plans (plan_key, version, title, description, valid_from)
    values ('di172-no-autorizado', 1, 'No autorizado', 'Fixture', current_date)$$,
  '42501', 'permission denied for table oral_care_routine_plans',
  'paciente no puede modificar el catálogo de planes'
);
select throws_ok(
  $$update public.oral_care_routine_plans set title = 'Edición no autorizada' where id = '92000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table oral_care_routine_plans',
  'paciente no puede actualizar planes'
);
select throws_ok(
  $$delete from public.oral_care_routine_plans where id = '92000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table oral_care_routine_plans',
  'paciente no puede eliminar planes'
);
select throws_ok(
  $$insert into public.oral_care_routine_activities (plan_id, activity_key, title, description, time_of_day, sort_order)
    values ('92000000-0000-4000-8000-000000000002', 'actividad-no-autorizada', 'No autorizada', 'Fixture', 'morning', 9)$$,
  '42501', 'permission denied for table oral_care_routine_activities',
  'paciente no puede insertar actividades al catálogo'
);
select throws_ok(
  $$update public.oral_care_routine_activities set title = 'Edición no autorizada' where id = '93000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table oral_care_routine_activities',
  'paciente no puede actualizar actividades'
);
select throws_ok(
  $$delete from public.oral_care_routine_activities where id = '93000000-0000-4000-8000-000000000002'$$,
  '42501', 'permission denied for table oral_care_routine_activities',
  'paciente no puede eliminar actividades'
);

select lives_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date)$$,
  'paciente A puede marcar actividad vigente para hoy'
);
select is((select count(*)::integer from public.patient_routine_completions where completion_date = current_setting('di172.test.today')::date), 1, 'la marca propia aparece una vez en el progreso de hoy');
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date)$$,
  '23505', 'duplicate key value violates unique constraint "patient_routine_completions_once_per_day"',
  'la restricción rechaza una segunda marca directa duplicada'
);
select lives_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date)
    on conflict (patient_id, activity_id, completion_date) do nothing$$,
  'la operación idempotente ignora un duplicado como el cliente de la aplicación'
);
select is((select count(*)::integer from public.patient_routine_completions where completion_date = current_setting('di172.test.today')::date), 1, 'el duplicado idempotente no aumenta el progreso');
select throws_ok(
  $$insert into public.patient_routine_completions (patient_id, plan_id, activity_id, completion_date)
    values ('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date)$$,
  '42501', 'permission denied for table patient_routine_completions',
  'el cliente no puede elegir el patient_id de otra cuenta'
);
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date - 1)$$,
  '42501', 'new row violates row-level security policy for table "patient_routine_completions"',
  'RLS rechaza fechas anteriores al día de Lima actual'
);
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date + 1)$$,
  '42501', 'new row violates row-level security policy for table "patient_routine_completions"',
  'RLS rechaza fechas futuras'
);
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003', current_setting('di172.test.today')::date)$$,
  '42501', 'new row violates row-level security policy for table "patient_routine_completions"',
  'RLS rechaza actividades cuya vigencia todavía no inicia'
);
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000004', '93000000-0000-4000-8000-000000000004', current_setting('di172.test.today')::date)$$,
  '42501', 'new row violates row-level security policy for table "patient_routine_completions"',
  'RLS rechaza actividades cuya vigencia terminó'
);
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', current_setting('di172.test.today')::date)$$,
  '42501', 'new row violates row-level security policy for table "patient_routine_completions"',
  'RLS rechaza una versión sustituida aunque su fecha final no haya vencido'
);
select is((select count(*)::integer from public.patient_routine_completions where plan_id = '92000000-0000-4000-8000-000000000001' and completion_date = current_setting('di172.test.today')::date - 1), 1, 'el historial conserva la marca y versión del plan anterior');

-- B no puede leer ni borrar filas de A; sí puede escribir su propia fila.
reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}}', true);
set local role authenticated;
select is((select count(*)::integer from public.patient_routine_completions where patient_id = '91000000-0000-4000-8000-000000000001'), 0, 'paciente B no lee filas de A');
with borradas as (
  delete from public.patient_routine_completions
  where patient_id = '91000000-0000-4000-8000-000000000001'
    and completion_date = current_setting('di172.test.today')::date
  returning id
) select is((select count(*)::integer from borradas), 0, 'paciente B no puede borrar filas de A');
select lives_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date)$$,
  'paciente B puede marcar su propia actividad'
);
select is((select count(*)::integer from public.patient_routine_completions where completion_date = current_setting('di172.test.today')::date), 1, 'el progreso que ve B contiene solo su marca');
select is((select count(*)::integer from public.patient_routine_completions where patient_id = '91000000-0000-4000-8000-000000000001'), 0, 'B tampoco ve la marca de A después de registrar la suya');

-- A conserva historial de solo lectura y puede desmarcar únicamente hoy.
reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"dentaia":{"version":"1","estado":"activo","roles":["paciente"]}}}', true);
set local role authenticated;
select is((select count(*)::integer from public.patient_routine_completions), 2, 'A ve sus dos marcas y no la de B');
select is((select count(*)::integer from public.patient_routine_completions where plan_id = '92000000-0000-4000-8000-000000000001' and completion_date = current_setting('di172.test.today')::date - 1), 1, 'A conserva la fecha histórica asociada al plan v1');
with borradas as (
  delete from public.patient_routine_completions
  where plan_id = '92000000-0000-4000-8000-000000000002'
    and activity_id = '93000000-0000-4000-8000-000000000002'
    and completion_date = current_setting('di172.test.today')::date
  returning id
) select is((select count(*)::integer from borradas), 1, 'A puede desmarcar su actividad de hoy');
with borradas as (
  delete from public.patient_routine_completions
  where plan_id = '92000000-0000-4000-8000-000000000001'
    and activity_id = '93000000-0000-4000-8000-000000000001'
    and completion_date = current_setting('di172.test.today')::date - 1
  returning id
) select is((select count(*)::integer from borradas), 0, 'A no puede borrar una marca histórica');
select is((select count(*)::integer from public.patient_routine_completions where completion_date = current_setting('di172.test.today')::date - 1), 1, 'la marca histórica permanece después del intento de borrado');

-- Cuenta activa sin rol paciente: catálogo vacío y escritura denegada.
reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"dentaia":{"version":"1","estado":"activo","roles":["odontologo"]}}}', true);
set local role authenticated;
select is((select count(*)::integer from public.oral_care_routine_plans), 0, 'cuenta autenticada sin rol paciente no lee catálogo');
select is((select count(*)::integer from public.patient_routine_completions), 0, 'cuenta sin rol paciente no lee marcas');
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_setting('di172.test.today')::date)$$,
  '42501', 'new row violates row-level security policy for table "patient_routine_completions"',
  'cuenta sin rol paciente no puede registrar actividad'
);

-- Sesión anónima: permisos SQL denegados, incluso antes de evaluar filas RLS.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select throws_ok(
  $$select * from public.oral_care_routine_plans$$,
  '42501', 'permission denied for table oral_care_routine_plans',
  'anon no puede leer el catálogo'
);
select throws_ok(
  $$insert into public.patient_routine_completions (plan_id, activity_id, completion_date)
    values ('92000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', current_date)$$,
  '42501', 'permission denied for table patient_routine_completions',
  'anon no puede registrar actividades'
);

reset role;
select * from finish();
rollback;
