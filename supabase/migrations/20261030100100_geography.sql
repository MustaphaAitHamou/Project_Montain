-- =====================================================================
-- Référentiel géographique : régions, wilayas, communes, villages.
-- Source des contours : OpenStreetMap (ODbL), voir docs/data-sources.md.
-- =====================================================================

create table public.regions (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  name_fr text not null,
  name_ar text,
  name_kab text,
  -- 'active' : couverte ; 'planned' : référentiel présent mais pas encore de couverture annoncée
  coverage_status text not null default 'planned' check (coverage_status in ('active', 'planned')),
  bbox extensions.geometry(Polygon, 4326),
  created_at timestamptz not null default now()
);

create table public.wilayas (
  code text primary key check (code ~ '^[0-9]{2}$'),
  region_id text references public.regions (id) on delete set null,
  name_fr text not null,
  name_ar text,
  name_kab text,
  name_en text,
  boundary extensions.geometry(MultiPolygon, 4326),
  centroid extensions.geography(Point, 4326),
  osm_id bigint,
  wikidata text,
  data_source text not null default 'osm',
  updated_at timestamptz not null default now()
);
create index wilayas_boundary_gix on public.wilayas using gist (boundary);

create table public.communes (
  code text primary key check (code ~ '^[0-9]{4}$'), -- code ONS
  wilaya_code text not null references public.wilayas (code),
  name_fr text not null,
  name_ar text,
  name_kab text,
  name_en text,
  daira_name_fr text,
  daira_name_ar text,
  population integer check (population is null or population >= 0),
  boundary extensions.geometry(MultiPolygon, 4326),
  centroid extensions.geography(Point, 4326) not null,
  osm_id bigint,
  wikidata text,
  data_source text not null default 'osm',
  search_name text generated always as (private.normalize_place_name(name_fr)) stored,
  updated_at timestamptz not null default now()
);
create index communes_wilaya on public.communes (wilaya_code);
create index communes_boundary_gix on public.communes using gist (boundary);
create index communes_centroid_gix on public.communes using gist (centroid);
create index communes_search_trgm on public.communes using gin (search_name extensions.gin_trgm_ops);
create index communes_name_ar_trgm on public.communes using gin (name_ar extensions.gin_trgm_ops);

-- Villages / lieux-dits : alimentés par import OSM (script) ou proposés par la communauté
-- puis validés par un modérateur. Aucun village n'est inventé.
create table public.villages (
  id uuid primary key default gen_random_uuid(),
  commune_code text references public.communes (code),
  name_fr text not null check (char_length(name_fr) between 2 and 120),
  name_ar text,
  name_kab text,
  alt_names text[] not null default '{}',
  location extensions.geography(Point, 4326) not null,
  source text not null check (source in ('osm', 'community', 'geonames')),
  source_ref text,
  status text not null default 'pending_review' check (status in ('active', 'pending_review', 'rejected')),
  proposed_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  search_name text generated always as (private.normalize_place_name(name_fr)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_ref)
);
create index villages_location_gix on public.villages using gist (location);
create index villages_commune on public.villages (commune_code);
create index villages_search_trgm on public.villages using gin (search_name extensions.gin_trgm_ops);
create trigger villages_updated_at before update on public.villages
  for each row execute function private.set_updated_at();

-- Commune contenant un point (ou la plus proche à moins d'~1 km, pour absorber
-- la simplification des contours). NULL si hors du référentiel.
create or replace function private.commune_at(p extensions.geography)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.code
  from public.communes c
  where c.boundary is not null
    and extensions.st_dwithin(c.boundary, p::extensions.geometry, 0.01)
  order by extensions.st_distance(c.boundary, p::extensions.geometry)
  limit 1;
$$;

create or replace function private.villages_set_commune()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.commune_code is null then
    new.commune_code := private.commune_at(new.location);
  end if;
  return new;
end;
$$;
create trigger villages_set_commune before insert or update of location on public.villages
  for each row execute function private.villages_set_commune();

-- ---------------------------------------------------------------------
-- Recherche unifiée de lieux (wilayas, communes, villages actifs)
-- ---------------------------------------------------------------------
create or replace function public.search_places(q text, max_results integer default 10)
returns table (
  kind text,
  id text,
  name_fr text,
  name_ar text,
  commune_code text,
  commune_name_fr text,
  wilaya_code text,
  wilaya_name_fr text,
  lat double precision,
  lng double precision,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select private.normalize_place_name(coalesce(q, '')) as nq,
           btrim(coalesce(q, '')) as rq,
           least(greatest(coalesce(max_results, 10), 1), 25) as lim
  ),
  candidates as (
    select 'commune'::text as kind, c.code as id, c.name_fr, c.name_ar,
           c.code as commune_code, c.name_fr as commune_name_fr,
           w.code as wilaya_code, w.name_fr as wilaya_name_fr,
           extensions.st_y(c.centroid::extensions.geometry) as lat,
           extensions.st_x(c.centroid::extensions.geometry) as lng,
           greatest(
             extensions.similarity(c.search_name, p.nq),
             case when c.search_name like p.nq || '%' then 0.9 else 0 end,
             case when c.name_ar is not null and c.name_ar like '%' || p.rq || '%' then 0.8 else 0 end
           )::real + 0.05 as score
    from public.communes c
    join public.wilayas w on w.code = c.wilaya_code
    cross join params p
    where char_length(p.nq) >= 2
      and (c.search_name operator(extensions.%) p.nq
           or c.search_name like '%' || p.nq || '%'
           or (c.name_ar is not null and c.name_ar like '%' || p.rq || '%'))
    union all
    select 'village', v.id::text, v.name_fr, v.name_ar,
           c.code, c.name_fr, w.code, w.name_fr,
           extensions.st_y(v.location::extensions.geometry),
           extensions.st_x(v.location::extensions.geometry),
           greatest(
             extensions.similarity(v.search_name, p.nq),
             case when v.search_name like p.nq || '%' then 0.9 else 0 end
           )::real
    from public.villages v
    left join public.communes c on c.code = v.commune_code
    left join public.wilayas w on w.code = c.wilaya_code
    cross join params p
    where v.status = 'active'
      and char_length(p.nq) >= 2
      and (v.search_name operator(extensions.%) p.nq or v.search_name like '%' || p.nq || '%')
    union all
    select 'wilaya', w.code, w.name_fr, w.name_ar, null, null, w.code, w.name_fr,
           extensions.st_y(w.centroid::extensions.geometry),
           extensions.st_x(w.centroid::extensions.geometry),
           (greatest(
             extensions.similarity(private.normalize_place_name(w.name_fr), p.nq),
             case when private.normalize_place_name(w.name_fr) like p.nq || '%' then 0.9 else 0 end
           ) + 0.1)::real
    from public.wilayas w
    cross join params p
    where char_length(p.nq) >= 2
      and w.centroid is not null
      and (private.normalize_place_name(w.name_fr) like '%' || p.nq || '%'
           or private.normalize_place_name(w.name_fr) operator(extensions.%) p.nq
           or (w.name_ar is not null and w.name_ar like '%' || p.rq || '%'))
  )
  select kind, id, name_fr, name_ar, commune_code, commune_name_fr, wilaya_code, wilaya_name_fr,
         lat, lng, score
  from candidates
  order by score desc, name_fr
  limit (select lim from params);
$$;

-- Contours simplifiés des communes en GeoJSON (fond de carte de repli, zones suivies).
create or replace function public.commune_boundaries_geojson(p_wilaya_codes text[] default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'id', c.code,
      'properties', jsonb_build_object('code', c.code, 'name_fr', c.name_fr, 'name_ar', c.name_ar,
                                       'wilaya_code', c.wilaya_code),
      'geometry', extensions.st_asgeojson(extensions.st_simplifypreservetopology(c.boundary, 0.002), 4)::jsonb
    )), '[]'::jsonb)
  )
  from public.communes c
  where c.boundary is not null
    and (p_wilaya_codes is null or c.wilaya_code = any (p_wilaya_codes));
$$;

-- Points représentatifs des communes (centroïde intérieur), par population décroissante.
create or replace function public.commune_points(p_limit integer default 40)
returns table (code text, name_fr text, wilaya_code text, lat double precision, lng double precision, population integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.code, c.name_fr, c.wilaya_code,
         extensions.st_y(c.centroid::extensions.geometry), extensions.st_x(c.centroid::extensions.geometry),
         c.population
  from public.communes c
  order by c.population desc nulls last, c.code
  limit least(greatest(coalesce(p_limit, 40), 1), 500);
$$;

-- ---------------------------------------------------------------------
-- RLS : lecture publique du référentiel, aucune écriture client
-- ---------------------------------------------------------------------
alter table public.regions enable row level security;
alter table public.wilayas enable row level security;
alter table public.communes enable row level security;
alter table public.villages enable row level security;

grant select on public.regions, public.wilayas, public.communes to anon, authenticated;
grant select on public.villages to anon, authenticated;

create policy regions_read on public.regions for select to anon, authenticated using (true);
create policy wilayas_read on public.wilayas for select to anon, authenticated using (true);
create policy communes_read on public.communes for select to anon, authenticated using (true);
create policy villages_read on public.villages for select to anon, authenticated
  using (status = 'active' or proposed_by = (select auth.uid()) or (select private.is_staff()));

grant execute on function public.search_places(text, integer) to anon, authenticated;
grant execute on function public.commune_boundaries_geojson(text[]) to anon, authenticated;
grant execute on function public.commune_points(integer) to anon, authenticated;
grant execute on function private.commune_at(extensions.geography) to authenticated;
