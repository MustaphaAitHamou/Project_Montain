-- =====================================================================
-- Couverture nationale : les 69 wilayas d'Algérie (découpage administratif de 2025).
--
-- Cette migration prépare la région « algerie » et les fonctions de carte ; les contours
-- des 63 wilayas et 1 249 communes hors Kabylie sont importés par la migration générée
-- suivante (20261120090100_geo_algeria_data.sql, données OpenStreetMap, ODbL 1.0).
-- Les six wilayas de lancement (Tizi Ouzou, Béjaïa, Bouira, Boumerdès, Bordj Bou Arréridj,
-- Sétif) restent celles importées par 20261030101000_geo_reference_data.sql.
-- =====================================================================

insert into public.regions (id, name_fr, name_ar, name_kab, coverage_status)
values ('algerie', 'Algérie', 'الجزائر', 'Lezzayer', 'active')
on conflict (id) do update
  set name_fr = excluded.name_fr, name_ar = excluded.name_ar, name_kab = excluded.name_kab,
      coverage_status = excluded.coverage_status;

-- Les wilayas de lancement rejoignent la couverture nationale. La ligne « kabylie » de
-- public.regions est conservée (historique du lancement) ; aucune donnée n'est supprimée.
update public.wilayas set region_id = 'algerie', updated_at = now() where region_id = 'kabylie';

update public.app_settings
set value = jsonb_build_object(
      'region', 'algerie',
      'wilayas', (select jsonb_agg(lpad(n::text, 2, '0') order by n) from generate_series(1, 69) as n)
    ),
    description = 'Zone couverte par le référentiel géographique : les 69 wilayas d''Algérie.'
where key = 'coverage';

-- ---------------------------------------------------------------------
-- Contours simplifiés des wilayas (fond de carte national de repli). Bien plus léger que
-- les 1 538 communes : la carte ne charge le détail communal qu'en zoomant.
-- ---------------------------------------------------------------------
create or replace function public.wilaya_boundaries_geojson(p_tolerance double precision default 0.01)
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
      'id', w.code,
      'properties', jsonb_build_object('code', w.code, 'name_fr', w.name_fr, 'name_ar', w.name_ar),
      'geometry', extensions.st_asgeojson(
        extensions.st_simplifypreservetopology(
          w.boundary, least(greatest(coalesce(p_tolerance, 0.01), 0.001), 0.1)
        ), 4)::jsonb
    ) order by w.code), '[]'::jsonb)
  )
  from public.wilayas w
  where w.boundary is not null;
$$;

grant execute on function public.wilaya_boundaries_geojson(double precision) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Distance (km) entre un point et le territoire couvert : 0 à l'intérieur d'une wilaya.
-- Utilisée par la synchronisation des séismes : seuls ceux en Algérie ou à proximité
-- (au large des côtes, près des frontières) deviennent des événements publics.
-- Réservée au backend (rôle service).
-- ---------------------------------------------------------------------
create or replace function public.coverage_distance_km(p_lat double precision, p_lng double precision)
returns double precision
language sql
stable
security invoker
set search_path = ''
as $$
  with pt as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326) as g
  )
  select min(extensions.st_distance(n.boundary::extensions.geography, pt.g::extensions.geography)) / 1000.0
  from pt
  cross join lateral (
    select w.boundary
    from public.wilayas w
    where w.boundary is not null
    order by w.boundary operator(extensions.<->) pt.g
    limit 3
  ) n;
$$;

revoke execute on function public.coverage_distance_km(double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.coverage_distance_km(double precision, double precision) to service_role;

-- ---------------------------------------------------------------------
-- Points de prévision météo répartis sur tout le pays : les communes les plus peuplées de
-- chaque wilaya (et non les plus peuplées du pays, qui seraient presque toutes à Alger).
-- ---------------------------------------------------------------------
create or replace function public.wilaya_forecast_points(p_per_wilaya integer default 2)
returns table (code text, name_fr text, wilaya_code text, lat double precision, lng double precision, population integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.code, r.name_fr, r.wilaya_code, r.lat, r.lng, r.population
  from (
    select c.code, c.name_fr, c.wilaya_code,
           extensions.st_y(c.centroid::extensions.geometry) as lat,
           extensions.st_x(c.centroid::extensions.geometry) as lng,
           c.population,
           row_number() over (partition by c.wilaya_code
                              order by c.population desc nulls last, c.code) as rank
    from public.communes c
  ) r
  where r.rank <= least(greatest(coalesce(p_per_wilaya, 2), 1), 5)
  order by r.wilaya_code, r.rank;
$$;

grant execute on function public.wilaya_forecast_points(integer) to anon, authenticated;

-- Séismes : rayon autour du territoire au-delà duquel un séisme reste une simple observation.
update public.alert_sources
set config = config || '{"eventMaxDistanceKm": 50}'::jsonb
where id = 'emsc' and not (config ? 'eventMaxDistanceKm');
