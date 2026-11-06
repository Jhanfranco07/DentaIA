-- Pruebas RLS de DEMO en la base desechable PostGIS construida con fixtures sintéticos.
\set ON_ERROR_STOP on

do $$ begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then raise exception 'falta PostGIS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.directory_demo_locations'::regclass) then raise exception 'RLS DEMO desactivado'; end if;
  if has_table_privilege('anon','public.directory_demo_locations','INSERT')
    or has_table_privilege('anon','public.directory_demo_locations','UPDATE')
    or has_table_privilege('anon','public.directory_demo_locations','DELETE') then raise exception 'anon tiene escritura DEMO'; end if;
  if has_table_privilege('authenticated','public.directory_demo_locations','INSERT')
    or has_table_privilege('authenticated','public.directory_demo_locations','UPDATE')
    or has_table_privilege('authenticated','public.directory_demo_locations','DELETE') then raise exception 'authenticated tiene escritura DEMO'; end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.directory_demo_locations'::regclass and contype = 'f') then raise exception 'DEMO no debe tener asociación a entidades reales'; end if;
  if (select count(*) from public.dentist_public_locations) <> 0 then raise exception 'DEMO fue insertada como consultorio verificado'; end if;
  if (select count(*) from clinical.professional_accounts) <> 1 or (select count(*) from clinical.clinic_memberships) <> 1 then raise exception 'cambiaron perfiles o membresías del fixture'; end if;
end $$;

set role anon;
do $$ begin
  if (select count(*) from public.directory_demo_locations) <> 1 then raise exception 'anon no puede leer DEMO publicada'; end if;
  begin
    insert into public.directory_demo_locations(slug,name,district,city,country,latitude,longitude,public_label,is_published)
    values ('intento-paciente','Falsa','La Molina','Lima','Perú',-12,-76,'DEMO — Clínica ficticia, no ofrece atención real',true);
    raise exception 'anon pudo insertar una DEMO';
  exception when insufficient_privilege then null; end;
  begin
    update public.directory_demo_locations set is_published = false;
    raise exception 'anon pudo ocultar una DEMO';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.directory_demo_locations;
    raise exception 'anon pudo eliminar una DEMO';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
do $$ begin
  if (select count(*) from public.directory_demo_locations) <> 1 then raise exception 'authenticated no puede leer DEMO publicada'; end if;
  begin
    insert into public.directory_demo_locations(slug,name,district,city,country,latitude,longitude,public_label,is_published)
    values ('intento-usuario','Falsa','La Molina','Lima','Perú',-12,-76,'DEMO — Clínica ficticia, no ofrece atención real',true);
    raise exception 'authenticated pudo insertar una DEMO';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Una fila oculta debe resultar invisible para visitantes.
update public.directory_demo_locations set is_published = false where slug = 'clinica-demo-la-molina';
set role anon;
do $$ begin
  if (select count(*) from public.directory_demo_locations) <> 0 then raise exception 'anon ve una DEMO no publicada'; end if;
end $$;
reset role;

-- Se limpia solo el registro DEMO sintético al terminar la prueba.
delete from public.directory_demo_locations where slug = 'clinica-demo-la-molina' and is_demo is true;
