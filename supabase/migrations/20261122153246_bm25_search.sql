-- Inverted index in the same database and transaction as the source records.
begin;

create schema dentaia_search;
revoke all on schema dentaia_search from public, anon, authenticated, service_role;
grant usage on schema dentaia_search to anon, authenticated, service_role;

create table dentaia_search.corpus (
  scope text primary key,
  documents bigint not null default 0,
  total_length bigint not null default 0
);
create table dentaia_search.documents (
  scope text not null,
  id uuid not null,
  length int not null,
  primary key (scope, id)
);
create table dentaia_search.terms (
  scope text not null,
  term text not null,
  df int not null,
  primary key (scope, term)
);
create table dentaia_search.postings (
  scope text not null,
  term text not null,
  id uuid not null,
  tf double precision not null,
  primary key (scope, term, id),
  foreign key (scope, id) references dentaia_search.documents(scope, id) on delete cascade
);
create index search_postings_document on dentaia_search.postings (scope, id);

create function dentaia_search.can_read(p_scope text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select p_scope = 'directory' or p_scope = ('requests/' || (select auth.uid())::text);
$$;

do $$
declare table_name text;
begin
  grant execute on function dentaia_search.can_read(text) to anon, authenticated;
  foreach table_name in array array['corpus', 'documents', 'terms', 'postings'] loop
    execute format('alter table dentaia_search.%I enable row level security', table_name);
    execute format('grant select on dentaia_search.%I to anon, authenticated', table_name);
    execute format(
      'create policy search_scope on dentaia_search.%I for select to anon, authenticated using (dentaia_search.can_read(scope))',
      table_name
    );
  end loop;
end;
$$;

create function dentaia_search.lexemes(p_text text)
returns table(term text, frequency int, first_position int)
language sql immutable security invoker set search_path = '' as $$
  select l.lexeme, cardinality(l.positions), l.positions[1]::int
  from unnest(to_tsvector('pg_catalog.spanish'::regconfig,
    regexp_replace(regexp_replace(
      regexp_replace(translate(lower(normalize(left(coalesce(p_text, ''), 16000), NFKC)),
        'áàäâéèëêíìïîóòöôúùüûç', 'aaaaeeeeiiiioooouuuuc'), '[^[:alnum:]ñ]+', ' ', 'g'),
      '\mortodoncistas?\M', 'ortodoncia', 'g'),
      '\modontopediatras?\M', 'odontopediatria', 'g')
  )) as l;
$$;

create function dentaia_search.query_terms(p_query text)
returns table(term text) language sql immutable security invoker set search_path = '' as $$
  select l.term from dentaia_search.lexemes(left(p_query, 160)) l
  order by l.first_position, l.term limit 12;
$$;

create function dentaia_search.bm25(
  p_tf double precision, p_df bigint, p_n bigint, p_length int, p_mean double precision,
  p_k1 double precision default 1.2, p_b double precision default 0.75
) returns double precision language sql immutable strict parallel safe security invoker set search_path = '' as $$
  select ln(1.0 + (p_n - p_df + 0.5)::double precision / (p_df + 0.5)::double precision)
    * p_tf * (p_k1 + 1.0) / (p_tf + p_k1 * (1.0 - p_b + p_b * p_length / nullif(p_mean, 0)));
$$;

create function dentaia_search.rank(p_scope text, p_query text, p_all boolean default false)
returns table(id uuid, score double precision)
language sql stable security invoker set search_path = '' as $$
  with query as materialized (select * from dentaia_search.query_terms(p_query))
  select p.id, sum(dentaia_search.bm25(p.tf, t.df, c.documents, d.length,
    c.total_length::double precision / nullif(c.documents, 0)))
  from query q
  join dentaia_search.terms t on t.scope = p_scope and t.term = q.term
  join dentaia_search.postings p on p.scope = t.scope and p.term = t.term
  join dentaia_search.documents d on d.scope = p.scope and d.id = p.id
  join dentaia_search.corpus c on c.scope = p.scope
  group by p.id having not p_all or count(*) = (select count(*) from query);
$$;

-- One transactional writer per corpus. Array entries are [text, weight].
create function dentaia_search.write_document(p_scope text, p_id uuid, p_fields jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  old_length int;
  new_length int;
  frequencies jsonb;
begin
  insert into dentaia_search.corpus(scope) values (p_scope) on conflict do nothing;
  perform 1 from dentaia_search.corpus where scope = p_scope for update;
  select length into old_length from dentaia_search.documents where scope = p_scope and id = p_id;

  if old_length is not null then
    update dentaia_search.terms t set df = t.df - 1 from dentaia_search.postings p
      where p.scope = p_scope and p.id = p_id and t.scope = p.scope and t.term = p.term;
    delete from dentaia_search.terms t using dentaia_search.postings p
      where p.scope = p_scope and p.id = p_id and t.scope = p.scope and t.term = p.term and t.df = 0;
    delete from dentaia_search.documents where scope = p_scope and id = p_id;
  end if;

  if p_fields is not null then
    select coalesce(sum(freq.length), 0), coalesce(jsonb_object_agg(freq.term, freq.tf), '{}'::jsonb)
    into new_length, frequencies
    from (
      select l.term, sum(l.frequency) as length, sum(l.frequency * (f.value->>1)::double precision) as tf
      from jsonb_array_elements(p_fields) f
      cross join lateral dentaia_search.lexemes(f.value->>0) l
      group by l.term
    ) freq;

    insert into dentaia_search.documents values (p_scope, p_id, new_length);
    insert into dentaia_search.terms as t select p_scope, key, 1 from jsonb_each(frequencies)
      on conflict (scope, term) do update set df = t.df + 1;
    insert into dentaia_search.postings select p_scope, key, p_id, value::double precision from jsonb_each(frequencies);
  end if;

  update dentaia_search.corpus set
    documents = documents + (new_length is not null)::int - (old_length is not null)::int,
    total_length = total_length + coalesce(new_length, 0) - coalesce(old_length, 0)
  where scope = p_scope;
  delete from dentaia_search.corpus where scope = p_scope and documents = 0;
end;
$$;

create table dentaia_search.directory_demo (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  specialty text not null,
  district text not null,
  latitude double precision,
  longitude double precision,
  reference_name text,
  reference_address text,
  services text,
  qa boolean not null default false
);
alter table dentaia_search.directory_demo enable row level security;
create policy read_demo on dentaia_search.directory_demo for select to anon, authenticated using (true);
grant select on dentaia_search.directory_demo to anon, authenticated;

-- Static catalogue projections. Display data still comes from catalogo-demo.ts and qa-preview.ts.
insert into dentaia_search.directory_demo
  (id, slug, name, specialty, district, latitude, longitude, reference_name, reference_address, services, qa) values
  ('d36a2026-0000-4000-8000-000000000001', 'odontologo-demo-s6-01', 'Alma Valcárcel', 'Odontología general', 'San Borja', -12.100849, -76.999601, 'Cerdent San Borja', 'Av. San Borja Sur 781, piso 2, San Borja, Lima, Perú', 'Consulta odontológica Limpieza dental', false),
  ('d36a2026-0000-4000-8000-000000000002', 'odontologo-demo-s6-02', 'Bruno Lévano', 'Ortodoncia', 'Jesús María', -12.089279, -77.058167, 'Cerdent Jesús María', 'Av. Faustino Sánchez Carrión 615, of. 303, Jesús María, Lima, Perú', 'Evaluación de alineación dental Control de ortodoncia', false),
  ('d36a2026-0000-4000-8000-000000000003', 'odontologo-demo-s6-03', 'Camila Ugarte', 'Endodoncia', 'La Molina', -12.070348, -76.95249, 'Cerdent La Molina', 'Av. Javier Prado Este 6210, of. 301, La Molina, Lima, Perú', 'Evaluación endodóntica Tratamiento de conductos', false),
  ('d36a2026-0000-4000-8000-000000000004', 'odontologo-demo-s6-04', 'Darío Montalva', 'Periodoncia', 'Miraflores', -12.128138, -77.005019, 'Romandent Miraflores', 'Av. Alfredo Benavides 2921, Miraflores, Lima, Perú', 'Evaluación periodontal Mantenimiento periodontal', false),
  ('d36a2026-0000-4000-8000-000000000005', 'odontologo-demo-s6-05', 'Elena Quispeña', 'Odontopediatría', 'San Isidro', -12.106403, -77.054749, 'Romandent San Isidro', 'Av. Augusto Pérez Araníbar 1764, San Isidro, Lima, Perú', 'Consulta odontopediátrica Control preventivo infantil', false),
  ('d36a2026-0000-4000-8000-000000000006', 'odontologo-demo-s6-06', 'Fabio Nacarino', 'Rehabilitación oral', 'Santiago de Surco', -12.105931, -76.973386, 'Romandent Surco', 'Jr. El Polo 348, Santiago de Surco, Lima, Perú', 'Evaluación para prótesis dental Revisión de prótesis', false),
  ('d36a2026-0000-4000-8000-000000000007', 'odontologo-demo-s6-07', 'Gala Sorelli', 'Cirugía oral', 'Miraflores', -12.119411, -77.026132, 'Dental Científica (Universidad Científica del Sur)', 'Av. Paseo de la República 5514, Miraflores, Lima, Perú', 'Consulta de cirugía oral Evaluación para extracción dental', false),
  ('d36a2026-0000-4000-8000-000000000008', 'odontologo-demo-s6-08', 'Hugo Altamir', 'Odontología general', 'Miraflores', -12.117637, -77.031481, 'Clínica Dental Smile Perfection', 'Calle Coronel Inclán 235, piso 3, of. 307, Miraflores, Lima, Perú', 'Consulta odontológica Limpieza dental', false),
  ('d36a2026-0000-4000-8000-000000000009', 'odontologo-demo-s6-09', 'Irene Beltrana', 'Ortodoncia', 'Lima', -12.069504, -77.037002, 'Centro Odontológico Universidad Wiener', 'Av. Arequipa 440-444, Lima, Lima, Perú', 'Evaluación de alineación dental Control de ortodoncia', false),
  ('d36a2026-0000-4000-8000-000000000010', 'odontologo-demo-s6-10', 'Julián Cárdenas', 'Endodoncia', 'Jesús María', -12.07, -77.0453, 'Vital Dent Integral', 'Av. Salaverry 1071, primer piso, Jesús María, Lima, Perú', 'Evaluación endodóntica Tratamiento de conductos', false),
  ('d36a2026-0000-4000-8000-000000000011', 'odontologo-demo-s6-11', 'Karla Menacho', 'Periodoncia', 'San Borja', -12.110287, -76.986509, 'Centro Odontológico Americano Primavera', 'Av. Primavera 643, interior 503, San Borja, Lima, Perú', 'Evaluación periodontal Mantenimiento periodontal', false),
  ('d36a2026-0000-4000-8000-000000000012', 'odontologo-demo-s6-12', 'Leo Villaflor', 'Odontopediatría', 'Miraflores', -12.12096, -77.027807, 'Dental Procare', 'Calle Alcanfores 142, interior 303, Miraflores, Lima, Perú', 'Consulta odontopediátrica Control preventivo infantil', false),
  ('d36a2026-0000-4000-8000-000000000013', 'odontologo-demo-s6-13', 'Mara Solandía', 'Rehabilitación oral', 'Lima', -12.074412, -77.034597, 'Bogdent', 'Jr. Subteniente Alejandro Tirado 318, int. 201, Lima, Lima, Perú', 'Evaluación para prótesis dental Revisión de prótesis', false),
  ('d36a2026-0000-4000-8000-000000000014', 'odontologo-demo-s6-14', 'Nico Peralta', 'Cirugía oral', 'Chorrillos', -12.177811, -76.997082, 'Odontosalud Chorrillos', 'Av. El Sol 1242, La Campiña, Chorrillos, Lima, Perú', 'Consulta de cirugía oral Evaluación para extracción dental', false),
  ('d36a2026-0000-4000-8000-000000000015', 'odontologo-demo-s6-15', 'Olivia Salceda', 'Odontología general', 'Los Olivos', -11.995633, -77.080356, 'Centro Odontológico Americano Los Olivos', 'Av. Carlos Alberto Izaguirre 1268, Los Olivos, Lima, Perú', 'Consulta odontológica Limpieza dental', false),
  ('d36a2026-0000-4000-8000-000000000016', 'odontologo-demo-s6-16', 'Pablo Arandia', 'Ortodoncia', 'Chorrillos', -12.17101, -77.022508, 'Multident Chorrillos', 'Av. Defensores del Morro 714, interiores 208-209, Chorrillos, Lima, Perú', 'Evaluación de alineación dental Control de ortodoncia', false),
  ('d36a2026-0000-4000-8000-000000000017', 'odontologo-demo-s6-17', 'Renata Bellido', 'Endodoncia', 'Pueblo Libre', -12.074555, -77.054864, 'Centro Especializado en Odontoestomatología', 'Av. Simón Bolívar 165, Pueblo Libre, Lima, Perú', 'Evaluación endodóntica Tratamiento de conductos', false),
  ('d36a2026-0000-4000-8000-000000000018', 'odontologo-demo-s6-18', 'Sergio Zambrana', 'Periodoncia', 'San Miguel', -12.071798, -77.098367, 'Dental Max San Miguel', 'Calle Contisuyo 299, piso 2, int. 202, San Miguel, Lima, Perú', 'Evaluación periodontal Mantenimiento periodontal', false),
  ('d36a2026-0000-4000-8000-000000000019', 'odontologo-demo-s6-19', 'Tania Cordera', 'Odontopediatría', 'San Miguel', -12.079831, -77.079575, 'Centro Odontológico Americano El Campillo', 'Calle Ayarsa de Morales 237, San Miguel, Lima, Perú', 'Consulta odontopediátrica Control preventivo infantil', false),
  ('d36a2026-0000-4000-8000-000000000020', 'odontologo-demo-s6-20', 'Ulises Marengo', 'Rehabilitación oral', 'Lince', -12.086597, -77.039917, 'Mueca Lince', 'Av. Julio César Tello 615, Lince, Lima, Perú', 'Evaluación para prótesis dental Revisión de prótesis', false),
  ('08d0c38f-2505-43ae-9c3a-2b3ccfa6b2fb', 'fase8-demo-a-e19e6bf1', 'Odontologo Demo A', 'Odontología general', 'Lima (zona de referencia)', null, null, null, null, null, true),
  ('77a82d0a-909a-4833-825d-cd4d57cf2a2b', 'fase8-demo-b-e19e6bf1', 'Odontologo Demo B', 'Odontología general', 'Lima (zona de referencia)', null, null, null, null, null, true);

create function dentaia_search.refresh_dentist(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  d public.dentists%rowtype;
  services text;
begin
  if exists (select 1 from dentaia_search.directory_demo where id = p_id) then return; end if;
  select * into d from public.dentists where id = p_id for no key update;
  if d.is_active is true then
    select string_agg(concat_ws(' ', s.name, s.description), ' ' order by s.sort_order, s.id)
    into services from public.dentist_services s where s.dentist_id = p_id and s.is_active;
    perform dentaia_search.write_document('directory', p_id, jsonb_build_array(
      jsonb_build_array(d.name, 3), jsonb_build_array(d.specialty, 2.5),
      jsonb_build_array(services, 2), jsonb_build_array(d.description, 1),
      jsonb_build_array(d.district, 1)));
  else
    perform dentaia_search.write_document('directory', p_id, null);
  end if;
end;
$$;

create function dentaia_search.refresh_request(p_owner uuid, p_id uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select dentaia_search.write_document('requests/' || p_owner::text, p_id, (
    select jsonb_build_array(jsonb_build_array(d.name, 3), jsonb_build_array(r.contact_name, 2))
    from public.appointment_requests r left join public.dentists d on d.id = r.dentist_id and d.is_active
    where r.id = p_id and r.user_id = p_owner and r.is_demo
  ));
$$;

create function dentaia_search.directory_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if TG_OP = 'DELETE' then
    perform dentaia_search.refresh_dentist(old.id);
    return null;
  end if;
  if TG_OP = 'UPDATE' and old.id <> new.id then
    perform dentaia_search.refresh_dentist(old.id);
  end if;
  perform dentaia_search.refresh_dentist(new.id);
  if TG_OP = 'UPDATE' and (new.name, new.is_active) is distinct from (old.name, old.is_active) then
    for r in select id, user_id from public.appointment_requests
      where dentist_id = new.id and is_demo order by user_id, id
    loop
      perform dentaia_search.refresh_request(r.user_id, r.id);
    end loop;
  end if;
  return null;
end;
$$;

create function dentaia_search.service_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare dentist uuid;
begin
  for dentist in
    select distinct id from unnest(array[
      case when TG_OP <> 'INSERT' then old.dentist_id end,
      case when TG_OP <> 'DELETE' then new.dentist_id end
    ]) id where id is not null order by id
  loop
    perform dentaia_search.refresh_dentist(dentist);
  end loop;
  return null;
end;
$$;

create function dentaia_search.request_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' or (TG_OP = 'UPDATE' and (old.user_id, old.id) is distinct from (new.user_id, new.id)) then
    perform dentaia_search.write_document('requests/' || old.user_id::text, old.id, null);
  end if;
  if TG_OP <> 'DELETE' then
    -- Synchronize with an update of the indexed dentist name or publication flag.
    perform 1 from public.dentists where id = new.dentist_id for share;
    perform dentaia_search.refresh_request(new.user_id, new.id);
  end if;
  return null;
end;
$$;

create function dentaia_search.profile_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'DELETE' or (TG_OP = 'UPDATE' and old.id <> new.id) then
    perform dentaia_search.write_document('admin', old.id, null);
  end if;
  if TG_OP <> 'DELETE' then
    perform dentaia_search.write_document('admin', new.id, jsonb_build_array(jsonb_build_array(new.full_name, 1)));
  end if;
  return null;
end;
$$;

create index search_requests_owner_date on public.appointment_requests (user_id, created_at desc, id) where is_demo;
create index search_requests_owner_preferred on public.appointment_requests (user_id, preferred_date) where is_demo;

create trigger bm25_dentists after insert or delete or update of id, name, specialty, district, description, is_active
  on public.dentists for each row execute function dentaia_search.directory_changed();
create trigger bm25_services after insert or delete or update of dentist_id, name, description, is_active, sort_order
  on public.dentist_services for each row execute function dentaia_search.service_changed();
create trigger bm25_requests after insert or delete or update of id, user_id, dentist_id, contact_name, is_demo
  on public.appointment_requests for each row execute function dentaia_search.request_changed();
create trigger bm25_profiles after insert or delete or update of id, full_name
  on public.profiles for each row execute function dentaia_search.profile_changed();

create function dentaia_search.rebuild()
returns void language plpgsql security invoker set search_path = '' as $$
declare row record;
begin
  lock public.dentists, public.dentist_services, public.appointment_requests, public.profiles in share row exclusive mode;
  truncate dentaia_search.postings, dentaia_search.terms, dentaia_search.documents, dentaia_search.corpus;
  for row in select * from dentaia_search.directory_demo order by id loop
    perform dentaia_search.write_document('directory', row.id, jsonb_build_array(
      jsonb_build_array(row.name, 3), jsonb_build_array(row.specialty, 2.5),
      jsonb_build_array(row.services, 2), jsonb_build_array(concat_ws(' ', row.district, row.reference_address), 1)));
  end loop;
  for row in select id from public.dentists where is_active order by id loop
    perform dentaia_search.refresh_dentist(row.id);
  end loop;
  for row in select id, user_id from public.appointment_requests where is_demo order by user_id, id loop
    perform dentaia_search.refresh_request(row.user_id, row.id);
  end loop;
  for row in select id, full_name from public.profiles order by id loop
    perform dentaia_search.write_document('admin', row.id, jsonb_build_array(jsonb_build_array(row.full_name, 1)));
  end loop;
end;
$$;

select dentaia_search.rebuild();

create function dentaia_search.distance_km(lat double precision, lon double precision,
  to_lat double precision, to_lon double precision)
returns double precision language sql immutable strict parallel safe security invoker set search_path = '' as $$
  select 6371.0088 * 2 * asin(sqrt(least(1.0,
    sin(radians(to_lat - lat) / 2)^2 + cos(radians(lat)) * cos(radians(to_lat))
    * sin(radians(to_lon - lon) / 2)^2)));
$$;

create function public.dentaia_buscar_directorio(
  p_query text, p_district text, p_specialty text, p_order text, p_page int, p_size int,
  p_lat double precision default null, p_lon double precision default null, p_radius int default null
) returns jsonb language plpgsql stable security invoker set search_path = '' set statement_timeout = '3s' as $$
begin
  if p_query is null or length(p_query) > 160 or p_district is null or length(p_district) > 160
    or p_specialty is null or length(p_specialty) > 160
    or p_order is null or p_order not in ('nombre','cercania','calificacion')
    or p_page is null or p_page not between 1 and 1000 or p_size is null or p_size not between 1 and 50
    or (p_lat is null) <> (p_lon is null)
    or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180))
    or (p_radius is not null and (p_lat is null or p_radius not in (5,10,25))) then
    raise exception 'PARAMETROS_DE_BUSQUEDA_INVALIDOS' using errcode = '22023';
  end if;
  p_query := btrim(p_query, E' \t\r\n');

  return (
    with profiles as not materialized (
      select d.id, d.name, btrim(d.district) district, btrim(d.specialty) specialty, false static_demo
      from public.dentists d where d.is_active
        and not exists (select 1 from dentaia_search.directory_demo s where s.id = d.id)
      union all
      select s.id, s.name, s.district, s.specialty, true from dentaia_search.directory_demo s
    ), references_public as not materialized (
      select s.id as dentist_id, r.id, r.slug, r.name, r.district, r.city, r.country,
        r.latitude, r.longitude, r.is_demo, r.is_published, r.requests_enabled, r.public_label
      from dentaia_search.directory_demo s join public.directory_demo_locations r using (slug)
      where not s.qa and r.is_demo and r.is_published and not r.requests_enabled
        and r.name = s.reference_name and r.district = s.district
        and abs(r.latitude - s.latitude) <= 0.000001 and abs(r.longitude - s.longitude) <= 0.000001
    ), matches as (
      select p.*, rank.score,
        case when p_lat is not null and (p_radius is not null or p_order = 'cercania') then (
          select min(dentaia_search.distance_km(p_lat, p_lon, u.latitude, u.longitude))
          from (
            select l.latitude, l.longitude from public.dentist_public_locations l
              where not p.static_demo and l.dentist_id = p.id
            union all
            select r.latitude, r.longitude from references_public r
              where p.static_demo and r.dentist_id = p.id
          ) u
        ) end as distance,
        case when p_order = 'calificacion' and not p.static_demo then (
          select avg(r.rating) from public.dentist_reviews r where r.dentist_id = p.id
        ) end as rating
      from profiles p left join dentaia_search.rank('directory', p_query) rank on rank.id = p.id
      where (p_query = '' or rank.id is not null)
        and (p_district = '' or p.district = p_district)
        and (p_specialty = '' or p.specialty = p_specialty)
    ), eligible as materialized (
      select * from matches where p_radius is null or distance <= p_radius
    ), counts as (
      select count(*) as total, least(p_page, greatest(1, (count(*) + p_size - 1) / p_size)) as page
      from eligible
    ), selected as (
      select id, name, static_demo, score, distance, rating from eligible
      order by score desc nulls last,
        case when p_order = 'cercania' then distance end nulls last, rating desc nulls last, name, id
      limit p_size offset (select (page - 1) * p_size from counts)
    )
    select jsonb_build_object(
      'total', counts.total, 'pagina', counts.page, 'tamano', p_size,
      'totalCatalogo', (select count(*) from profiles),
      'distritos', (select coalesce(jsonb_agg(distinct district), '[]') from profiles where district <> ''),
      'especialidades', (select coalesce(jsonb_agg(distinct specialty), '[]') from profiles where specialty <> ''),
      'hayUbicaciones', exists (select 1 from public.dentist_public_locations)
        or exists (select 1 from references_public),
      'hayResenas', exists (select 1 from public.dentist_reviews),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'dentista', case when d.id is not null then jsonb_build_object(
            'id', d.id, 'slug', d.slug, 'name', d.name, 'specialty', d.specialty, 'district', d.district,
            'consultation_price', d.consultation_price, 'currency', d.currency, 'initials', d.initials,
            'avatar_color', d.avatar_color, 'description', d.description, 'is_demo', d.is_demo,
            'is_active', d.is_active, 'created_at', d.created_at) end, 'referencia', to_jsonb(ref) - 'dentist_id',
          'ubicaciones', coalesce(loc.items, '[]'), 'promedio', reviews.rating, 'totalResenas', reviews.total
        ) order by p.score desc nulls last, case when p_order = 'cercania' then p.distance end nulls last,
          p.rating desc nulls last, p.name, p.id)
        from selected p
        left join public.dentists d on p.id = d.id and not p.static_demo
        left join references_public ref on ref.dentist_id = p.id and p.static_demo
        left join lateral (
          select jsonb_agg(jsonb_build_object('id', l.id, 'dentist_id', l.dentist_id,
            'practice_name', l.practice_name, 'practice_address', l.practice_address,
            'latitude', l.latitude, 'longitude', l.longitude, 'created_at', l.created_at) order by l.id) items
          from public.dentist_public_locations l where not p.static_demo and l.dentist_id = p.id
        ) loc on true
        left join lateral (
          select count(*) as total, avg(r.rating) as rating
          from public.dentist_reviews r where not p.static_demo and r.dentist_id = p.id
        ) reviews on true
      ), '[]')
    ) from counts
  );
end;
$$;

create function public.dentaia_buscar_solicitudes(p_query text, p_status text, p_page int, p_size int)
returns jsonb language plpgsql stable security invoker set search_path = '' set statement_timeout = '3s' as $$
declare
  owner_id uuid := auth.uid();
  preferred date;
begin
  if owner_id is null then raise exception 'SESION_REQUERIDA' using errcode = '42501'; end if;
  if p_query is null or length(p_query) > 160 or p_status is null or p_status not in ('todas','requested','cancelled')
    or p_page is null or p_page not between 1 and 1000 or p_size is null or p_size not between 1 and 50 then
    raise exception 'PARAMETROS_DE_BUSQUEDA_INVALIDOS' using errcode = '22023';
  end if;
  p_query := btrim(p_query, E' \t\r\n');
  if p_query ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      preferred := p_query::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      preferred := '-infinity'::date;
    end;
  end if;

  return (
    with summary as (
      select count(*) total, count(*) filter (where r.status = 'requested') requested,
        count(*) filter (where r.status = 'cancelled') cancelled
      from public.appointment_requests r where r.user_id = owner_id and r.is_demo
    ), terms as materialized (
      select q.term from dentaia_search.query_terms(p_query) q where p_query <> '' and preferred is null
    ), message_lexemes as materialized (
      -- Free-form messages may contain sensitive information. Analyze only the current
      -- owner's existing rows in this statement and retain no tokens or statistics.
      select r.id, l.term, l.frequency from public.appointment_requests r
      cross join lateral dentaia_search.lexemes(r.message) l
      where r.user_id = owner_id and r.is_demo and r.message <> '' and exists (select 1 from terms)
    ), message_lengths as (
      select id, sum(frequency)::int length from message_lexemes group by id
    ), message_terms as (
      select l.term, count(*) df from message_lexemes l join terms t using (term) group by l.term
    ), message_rank as (
      select l.id, sum(dentaia_search.bm25(l.frequency, t.df, s.total, n.length,
        (select sum(length)::double precision from message_lengths) / nullif(s.total, 0))) score
      from message_lexemes l join message_terms t using (term)
      join message_lengths n on n.id = l.id cross join summary s group by l.id
    ), names as (
      select * from dentaia_search.rank('requests/' || owner_id::text, p_query)
      where exists (select 1 from terms)
    ), eligible as materialized (
      select r.id, r.created_at, coalesce(n.score, 0) + coalesce(m.score, 0) score
      from public.appointment_requests r left join names n on n.id = r.id left join message_rank m on m.id = r.id
      where r.user_id = owner_id and r.is_demo and (p_status = 'todas' or r.status = p_status)
        and (p_query = '' or r.preferred_date = preferred or (preferred is null and (n.id is not null or m.id is not null)))
    ), counts as (
      select count(*) total, least(p_page, greatest(1, (count(*) + p_size - 1) / p_size)) page from eligible
    ), selected as (
      select * from eligible order by score desc, created_at desc, id
      limit p_size offset (select (page - 1) * p_size from counts)
    )
    select jsonb_build_object(
      'total', counts.total, 'pagina', counts.page, 'tamano', p_size,
      'totalSolicitudes', summary.total, 'solicitadas', summary.requested, 'canceladas', summary.cancelled,
      'items', coalesce((
        select jsonb_agg(to_jsonb(r) || jsonb_build_object('dentists', case when d.id is not null
          then jsonb_build_object('name', d.name) end) order by p.score desc, p.created_at desc, p.id)
        from selected p join public.appointment_requests r on r.id = p.id
        left join public.dentists d on d.id = r.dentist_id and d.is_active
      ), '[]')
    ) from counts cross join summary
  );
end;
$$;

-- Auth states and app_metadata remain live. Only profiles.full_name is copied to
-- the private admin corpus. The public-schema wrapper is service_role-only.
create function dentaia_search.admin_users(p_query text, p_role text, p_status text, p_page int, p_size int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare exact_id uuid;
begin
  if p_query is null or length(btrim(p_query)) not between 1 and 80
    or p_role is null or p_role not in ('todos','paciente','odontologo','superusuario','sin_asignacion','asignacion_invalida')
    or p_status is null or p_status not in ('todos','habilitada','suspendida','sin_confirmar','anonima','eliminada','inconsistente')
    or p_page is null or p_page not between 1 and 1000 or p_size is null or p_size not in (5,10,20) then
    raise exception 'PARAMETROS_DE_BUSQUEDA_INVALIDOS' using errcode = '22023';
  end if;
  if btrim(p_query) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    exact_id := btrim(p_query)::uuid;
  end if;

  return (
    with candidates as (
      select id, score from dentaia_search.rank('admin', p_query, true) where exact_id is null
      union all select exact_id, 1 where exact_id is not null
    ), decoded as (
      select u.id, c.score, p.full_name,
        case when u.deleted_at is not null then 'eliminada'
          when u.aud is distinct from 'authenticated' or u.is_anonymous is null then 'inconsistente'
          when u.is_anonymous then 'anonima'
          when u.banned_until > statement_timestamp() then 'suspendida'
          when u.confirmed_at is null then 'sin_confirmar' else 'habilitada' end as account,
        a.data,
        case when jsonb_typeof(a.data) = 'object' and a.data->'version' = '1'::jsonb
          and a.data->>'estado' in ('activo','suspendido') and jsonb_typeof(a.data->'roles') = 'array'
        then (select count(*) between 1 and 3 and count(*) = count(distinct value)
          and bool_and(value in ('"paciente"'::jsonb,'"odontologo"'::jsonb,'"superusuario"'::jsonb))
          from jsonb_array_elements(a.data->'roles'))
        else false end as valid
      from candidates c join auth.users u on u.id = c.id left join public.profiles p on p.id = c.id
      cross join lateral (select coalesce(u.raw_app_meta_data, '{}'::jsonb)->'dentaia' as data) a
    ), eligible as materialized (
      select id, score, full_name, account,
        case when data is null then 'ausente' when not valid then 'invalida'
          when data->>'estado' = 'activo' then 'activa' else 'suspendida' end as assignment,
        case when valid then data->'roles' else '[]'::jsonb end as roles
      from decoded
      where (p_status = 'todos' or account = p_status) and (p_role = 'todos'
        or (p_role = 'sin_asignacion' and data is null)
        or (p_role = 'asignacion_invalida' and data is not null and not valid)
        or (valid and p_role in ('paciente','odontologo','superusuario') and data->'roles' ? p_role))
    ), counts as (
      select count(*) total, greatest(1, (count(*) + p_size - 1) / p_size) pages from eligible
    ), selected as (
      select * from eligible order by score desc, id
      limit p_size offset (select (least(p_page, pages) - 1) * p_size from counts)
    )
    select jsonb_build_object('origen', 'supabase', 'consistencia', 'lectura_no_transaccional',
      'total', total, 'pagina', least(p_page, pages), 'paginas', pages, 'tamano', p_size,
      'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'cuenta', account,
        'perfil', jsonb_build_object('estado', case when full_name is null then 'ausente' else 'presente' end, 'nombre', full_name),
        'asignacion', jsonb_build_object('estado', assignment, 'roles', roles)
      ) order by score desc, id) from selected), '[]'))
    from counts
  );
end;
$$;

create function public.dentaia_buscar_usuarios(p_query text, p_role text, p_status text, p_page int, p_size int)
returns jsonb language sql stable security invoker set search_path = '' set statement_timeout = '4s' as $$
  select dentaia_search.admin_users(p_query, p_role, p_status, p_page, p_size);
$$;

revoke execute on all functions in schema dentaia_search from public, anon, authenticated, service_role;
grant execute on function dentaia_search.can_read(text), dentaia_search.lexemes(text), dentaia_search.query_terms(text),
  dentaia_search.bm25(double precision,bigint,bigint,int,double precision,double precision,double precision),
  dentaia_search.rank(text,text,boolean), dentaia_search.distance_km(double precision,double precision,double precision,double precision)
  to anon, authenticated;
grant execute on function dentaia_search.admin_users(text,text,text,int,int) to service_role;

revoke execute on function public.dentaia_buscar_directorio(text,text,text,text,int,int,double precision,double precision,int),
  public.dentaia_buscar_solicitudes(text,text,int,int), public.dentaia_buscar_usuarios(text,text,text,int,int)
  from public, anon, authenticated, service_role;
grant execute on function public.dentaia_buscar_directorio(text,text,text,text,int,int,double precision,double precision,int)
  to anon, authenticated;
grant execute on function public.dentaia_buscar_solicitudes(text,text,int,int) to authenticated;
grant execute on function public.dentaia_buscar_usuarios(text,text,text,int,int) to service_role;

notify pgrst, 'reload schema';

commit;
