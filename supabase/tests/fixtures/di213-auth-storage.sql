DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, aud text, is_anonymous boolean, confirmed_at timestamptz,
  deleted_at timestamptz, banned_until timestamptz, raw_app_meta_data jsonb
);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id), not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), full_name text);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit integer, allowed_mime_types text[]);
CREATE TABLE storage.objects (bucket_id text REFERENCES storage.buckets(id), name text);
CREATE FUNCTION storage.foldername(path text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(path,'/') $$;
CREATE FUNCTION storage.allow_only_operation(operation text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('storage.operation',true)=operation,false)
$$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT ON storage.objects TO authenticated;


CREATE TABLE public.dentists (id uuid PRIMARY KEY);
