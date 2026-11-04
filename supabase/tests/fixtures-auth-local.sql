-- SOLO contenedor PostgreSQL DESECHABLE. No ejecutar contra Supabase.
-- Aborta si existe Auth: nunca reutilizar una base de datos de la aplicación.
do $$ begin
  if to_regclass('auth.users') is not null then raise exception 'BASE_NO_DESECHABLE'; end if;
end $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key, aud text default 'authenticated', is_anonymous boolean default false,
  confirmed_at timestamptz default now(), deleted_at timestamptz, banned_until timestamptz, raw_app_meta_data jsonb default '{}');
create table auth.mfa_factors(id uuid primary key,user_id uuid,status text,factor_type text);
create table auth.sessions(id uuid primary key,user_id uuid,factor_id uuid,aal text,not_after timestamptz);
create table auth.mfa_amr_claims(session_id uuid,authentication_method text,updated_at timestamptz);

create function public.qa_id(n integer) returns uuid language sql immutable as $$
  select ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;
create function public.qa_peticion(objetivo integer, aprobacion integer, revision integer default 0, esperada jsonb default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('usuarioId',public.qa_id(objetivo),'operacion','asignar','rol','paciente',
    'revisionEsperada',revision,'asignacionEsperada',esperada,'aprobacionId',public.qa_id(aprobacion));
$$;
create function public.qa_contexto() returns jsonb language sql volatile as $$
  select jsonb_build_object('actorId',public.qa_id(1),'sesionId',public.qa_id(11),'expira',floor(extract(epoch from clock_timestamp()))::bigint+3600);
$$;
