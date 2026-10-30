-- =====================================================================
-- API : vues de lecture et fonctions (RPC). Toutes les écritures sensibles
-- passent par ces fonctions, qui contrôlent l'identité, le rôle, les
-- invariants métier et journalisent dans audit_logs.
-- Codes d'erreur : le message commence par un identifiant stable
-- (ex. « rate_limited ») traduit par les applications.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vue de lecture des événements (RLS de alert_events appliquée : security_invoker)
-- ---------------------------------------------------------------------
create view public.event_feed
with (security_invoker = true)
as
select
  e.id, e.category_id, e.subcategory_id, e.status, e.severity, e.source_kind, e.is_public, e.is_demo,
  extensions.st_y(e.location::extensions.geometry) as lat,
  extensions.st_x(e.location::extensions.geometry) as lng,
  e.location_uncertainty_m, e.commune_code,
  c.name_fr as commune_name_fr, c.name_ar as commune_name_ar,
  e.wilaya_code, w.name_fr as wilaya_name_fr, w.name_ar as wilaya_name_ar,
  e.public_note, e.started_at, e.ended_at, e.last_activity_at, e.report_count,
  e.external_source_id, e.external_url, e.magnitude, e.depth_km, e.details, e.version,
  e.created_at, e.updated_at
from public.alert_events e
left join public.communes c on c.code = e.commune_code
left join public.wilayas w on w.code = e.wilaya_code;

grant select on public.event_feed to anon, authenticated;

-- Vue des signalements bruts avec coordonnées : RLS de alert_reports appliquée
-- (auteur ou équipe de modération uniquement).
create view public.report_feed
with (security_invoker = true)
as
select
  r.id, r.author_id, r.category_id, r.subcategory_id, r.description,
  extensions.st_y(r.location::extensions.geometry) as lat,
  extensions.st_x(r.location::extensions.geometry) as lng,
  r.location_precision, r.location_uncertainty_m, r.commune_code, c.name_fr as commune_name_fr,
  r.wilaya_code, r.observed_at, r.moderation_status, r.rejection_reason, r.event_id,
  r.moderated_at, r.withdrawn_at, r.created_at
from public.alert_reports r
left join public.communes c on c.code = r.commune_code;

grant select on public.report_feed to authenticated;

-- Événements dans une emprise (index GiST sur location::geometry).
create or replace function public.events_in_bbox(
  p_west double precision, p_south double precision, p_east double precision, p_north double precision,
  p_categories text[] default null,
  p_statuses public.verification_status[] default null,
  p_since timestamptz default null,
  p_limit integer default 500
)
returns setof public.event_feed
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.alert_events e
  join public.event_feed f on f.id = e.id
  where e.is_public
    and e.location::extensions.geometry operator(extensions.&&)
        extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    and (p_categories is null or e.category_id = any (p_categories))
    and (p_statuses is null or e.status = any (p_statuses))
    and (p_since is null or e.last_activity_at >= p_since)
  order by e.last_activity_at desc
  limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

-- Événements à proximité d'un point (index GiST sur geography, distance en mètres).
create or replace function public.events_near(
  p_lat double precision, p_lng double precision, p_radius_m integer,
  p_categories text[] default null,
  p_active_only boolean default true,
  p_limit integer default 100
)
returns setof public.event_feed
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.alert_events e
  join public.event_feed f on f.id = e.id
  where e.is_public
    and extensions.st_dwithin(
          e.location,
          extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
          least(greatest(p_radius_m, 100), 100000))
    and (p_categories is null or e.category_id = any (p_categories))
    and (not p_active_only or e.status in ('received', 'under_review', 'corroborated', 'confirmed'))
  order by e.last_activity_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- Observations externes (séismes, points chauds) dans une emprise.
create or replace function public.observations_in_bbox(
  p_west double precision, p_south double precision, p_east double precision, p_north double precision,
  p_kinds text[] default null,
  p_since timestamptz default null,
  p_limit integer default 1000
)
returns table (
  id uuid, source_id text, kind text, lat double precision, lng double precision,
  observed_at timestamptz, magnitude numeric, depth_km numeric, confidence text, title text,
  payload jsonb, event_id uuid, is_demo boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.source_id, o.kind,
         extensions.st_y(o.location::extensions.geometry), extensions.st_x(o.location::extensions.geometry),
         o.observed_at, o.magnitude, o.depth_km, o.confidence, o.title, o.payload, o.event_id, o.is_demo
  from public.external_observations o
  where o.location::extensions.geometry operator(extensions.&&)
        extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    and (p_kinds is null or o.kind = any (p_kinds))
    and (p_since is null or o.observed_at >= p_since)
  order by o.observed_at desc
  limit least(greatest(coalesce(p_limit, 1000), 1), 5000);
$$;

-- Résumé « Mes villages » : alertes actives connues autour de chaque lieu suivi.
create or replace function public.my_followed_places_summary()
returns table (
  id uuid, label text, place_type text, commune_code text, commune_name_fr text, commune_name_ar text,
  wilaya_code text, wilaya_name_fr text, wilaya_name_ar text, lat double precision, lng double precision,
  radius_m integer, categories text[], notify boolean, min_severity public.severity_level,
  active_events integer, last_event_at timestamptz, created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, f.label, f.place_type, f.commune_code, c.name_fr, c.name_ar,
         c.wilaya_code, w.name_fr, w.name_ar,
         extensions.st_y(f.location::extensions.geometry), extensions.st_x(f.location::extensions.geometry),
         f.radius_m, f.categories, f.notify, f.min_severity,
         (select count(*)::integer from public.alert_events e
           where e.is_public and e.status in ('received', 'under_review', 'corroborated', 'confirmed')
             and (cardinality(f.categories) = 0 or e.category_id = any (f.categories))
             and ((f.place_type = 'commune' and e.commune_code = f.commune_code)
                  or extensions.st_dwithin(e.location, f.location, f.radius_m))),
         (select max(e.last_activity_at) from public.alert_events e
           where e.is_public and e.status <> 'rejected'
             and (cardinality(f.categories) = 0 or e.category_id = any (f.categories))
             and ((f.place_type = 'commune' and e.commune_code = f.commune_code)
                  or extensions.st_dwithin(e.location, f.location, f.radius_m))),
         f.created_at
  from public.user_followed_places f
  left join public.communes c on c.code = f.commune_code
  left join public.wilayas w on w.code = c.wilaya_code
  where f.user_id = (select auth.uid())
  order by f.created_at;
$$;

-- ---------------------------------------------------------------------
-- Signalements
-- ---------------------------------------------------------------------
create or replace function public.submit_report(
  p_client_id uuid,
  p_category_id text,
  p_subcategory_id text,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_location_precision public.location_precision,
  p_location_uncertainty_m integer,
  p_observed_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_category public.alert_categories;
  v_sub public.alert_subcategories;
  v_description text := btrim(coalesce(p_description, ''));
  v_point extensions.geography;
  v_commune text;
  v_wilaya text;
  v_uncertainty integer;
  v_existing public.alert_reports;
  v_report_id uuid;
  v_min_len integer;
  v_max_age_hours integer;
  v_dedup_radius integer;
  v_dedup_window integer;
  v_duplicates uuid[];
  v_auto_categories jsonb;
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null or v_profile.is_suspended then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  -- Idempotence (file hors ligne, double envoi)
  select * into v_existing from public.alert_reports where author_id = v_uid and client_id = p_client_id;
  if v_existing.id is not null then
    return jsonb_build_object('report_id', v_existing.id, 'status', v_existing.moderation_status,
                              'idempotent', true, 'possible_duplicates', '[]'::jsonb);
  end if;

  -- Limitation du nombre de signalements
  if (select count(*) from public.alert_reports
      where author_id = v_uid and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.alert_reports
         where author_id = v_uid and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  select * into v_category from public.alert_categories where id = p_category_id and is_active;
  if v_category.id is null or v_category.module <> 'alerts' then
    raise exception 'category_not_reportable' using errcode = '22023';
  end if;
  select * into v_sub from public.alert_subcategories
  where id = p_subcategory_id and category_id = p_category_id and is_active;
  if v_sub.id is null or not v_sub.reportable then
    raise exception 'subcategory_invalid' using errcode = '22023';
  end if;

  v_min_len := coalesce((v_category.validation_rules ->> 'minDescriptionLength')::integer, 10);
  v_max_age_hours := coalesce((v_category.validation_rules ->> 'maxObservedAgeHours')::integer, 24);
  if char_length(v_description) < v_min_len then
    raise exception 'description_too_short' using errcode = '22023';
  end if;
  if char_length(v_description) > 2000 then
    raise exception 'description_too_long' using errcode = '22023';
  end if;
  if private.contains_personal_contact(v_description) then
    raise exception 'personal_contact_not_allowed' using errcode = '22023';
  end if;
  if p_observed_at is null or p_observed_at > now() + interval '5 minutes' then
    raise exception 'observed_in_future' using errcode = '22023';
  end if;
  if p_observed_at < now() - make_interval(hours => v_max_age_hours) then
    raise exception 'observed_too_old' using errcode = '22023';
  end if;
  if p_location_precision = 'uncertain'
     and not coalesce((v_category.validation_rules ->> 'allowUncertainLocation')::boolean, false) then
    raise exception 'location_must_be_precise' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_location' using errcode = '22023';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_commune := private.commune_at(v_point);
  if v_commune is null then
    raise exception 'outside_coverage' using errcode = '22023';
  end if;
  select wilaya_code into v_wilaya from public.communes where code = v_commune;

  v_uncertainty := coalesce(p_location_uncertainty_m,
    case p_location_precision when 'exact' then 50 when 'approximate' then 500 else 2000 end);
  v_uncertainty := least(greatest(v_uncertainty, 0), 20000);

  insert into public.alert_reports (
    author_id, client_id, category_id, subcategory_id, description, location, location_precision,
    location_uncertainty_m, commune_code, wilaya_code, observed_at
  ) values (
    v_uid, p_client_id, p_category_id, p_subcategory_id, v_description, v_point, p_location_precision,
    v_uncertainty, v_commune, v_wilaya, p_observed_at
  ) returning id into v_report_id;

  -- Détection de doublons possibles (événements actifs proches de même catégorie)
  v_dedup_radius := coalesce((v_category.notification_rules ->> 'dedupRadiusMeters')::integer, 1000);
  v_dedup_window := coalesce((v_category.notification_rules ->> 'dedupWindowMinutes')::integer, 180);
  select coalesce(array_agg(e.id order by extensions.st_distance(e.location, v_point)), '{}')
  into v_duplicates
  from (
    select e.id, e.location from public.alert_events e
    where e.category_id = p_category_id
      and e.is_public and not e.is_demo
      and e.status in ('received', 'under_review', 'corroborated', 'confirmed')
      and e.last_activity_at > now() - make_interval(mins => v_dedup_window)
      and extensions.st_dwithin(e.location, v_point, v_dedup_radius + v_uncertainty)
    limit 5
  ) e;

  -- Publication immédiate « Reçu, non vérifié » : uniquement pour les catégories
  -- explicitement configurées par un administrateur (désactivé par défaut).
  v_auto_categories := coalesce(private.setting('auto_publish_categories'), '[]'::jsonb);
  if v_auto_categories ? p_category_id then
    if cardinality(v_duplicates) > 0 then
      v_event_id := v_duplicates[1];
      update public.alert_events set last_activity_at = now() where id = v_event_id;
    else
      insert into public.alert_events (
        category_id, subcategory_id, status, severity, source_kind, is_public, location,
        location_uncertainty_m, started_at, created_by
      ) values (
        p_category_id, p_subcategory_id, 'received',
        case when private.severity_rank(v_sub.default_severity) > private.severity_rank('vigilance')
             then 'vigilance'::public.severity_level else v_sub.default_severity end,
        'community', true, v_point, v_uncertainty, p_observed_at, v_uid
      ) returning id into v_event_id;
    end if;
    update public.alert_reports set event_id = v_event_id where id = v_report_id;
  end if;

  perform private.log_audit('report.submitted', 'report', v_report_id::text,
    jsonb_build_object('category', p_category_id, 'commune', v_commune, 'auto_event', v_event_id));

  return jsonb_build_object(
    'report_id', v_report_id,
    'status', 'pending',
    'idempotent', false,
    'commune_code', v_commune,
    'event_id', v_event_id,
    'possible_duplicates', to_jsonb(v_duplicates)
  );
end;
$$;

create or replace function public.withdraw_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.alert_reports;
begin
  select * into v_report from public.alert_reports where id = p_report_id for update;
  if v_report.id is null or v_report.author_id is distinct from (select auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_report.moderation_status <> 'pending' then
    raise exception 'report_not_pending' using errcode = '55000';
  end if;
  update public.alert_reports
  set moderation_status = 'withdrawn', withdrawn_at = now()
  where id = p_report_id;
  -- Un événement publié automatiquement et qui ne repose que sur ce signalement est retiré.
  if v_report.event_id is not null and not exists (
    select 1 from public.alert_reports r
    where r.event_id = v_report.event_id and r.id <> p_report_id
      and r.moderation_status in ('pending', 'approved', 'merged')
  ) then
    perform set_config('app.change_reason', 'Signalement retiré par son auteur', true);
    update public.alert_events set status = 'rejected'
    where id = v_report.event_id and status = 'received';
  end if;
  perform private.log_audit('report.withdrawn', 'report', p_report_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.update_report_description(p_report_id uuid, p_description text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.alert_reports;
  v_min_len integer;
  v_description text := btrim(coalesce(p_description, ''));
begin
  select * into v_report from public.alert_reports where id = p_report_id for update;
  if v_report.id is null or v_report.author_id is distinct from (select auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_report.moderation_status <> 'pending' or v_report.created_at < now() - interval '30 minutes' then
    raise exception 'edit_window_closed' using errcode = '55000';
  end if;
  select coalesce((validation_rules ->> 'minDescriptionLength')::integer, 10) into v_min_len
  from public.alert_categories where id = v_report.category_id;
  if char_length(v_description) < v_min_len or char_length(v_description) > 2000 then
    raise exception 'description_invalid_length' using errcode = '22023';
  end if;
  if private.contains_personal_contact(v_description) then
    raise exception 'personal_contact_not_allowed' using errcode = '22023';
  end if;
  update public.alert_reports set description = v_description where id = p_report_id;
end;
$$;

-- Enregistre une photo déjà déposée en quarantaine par son auteur.
-- Type et taille sont lus dans les métadonnées de Storage (pas dans la requête client).
create or replace function public.register_report_media(p_report_id uuid, p_path text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.alert_reports;
  v_object storage.objects;
  v_mime text;
  v_size bigint;
  v_id uuid;
begin
  select * into v_report from public.alert_reports where id = p_report_id;
  if v_report.id is null or v_report.author_id is distinct from v_uid then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_report.moderation_status not in ('pending') then
    raise exception 'report_not_pending' using errcode = '55000';
  end if;
  if p_path is null or p_path not like v_uid::text || '/' || p_report_id::text || '/%' then
    raise exception 'invalid_media_path' using errcode = '22023';
  end if;
  if (select count(*) from public.alert_media where report_id = p_report_id) >= 3 then
    raise exception 'media_limit_reached' using errcode = '54000';
  end if;
  select * into v_object from storage.objects
  where bucket_id = 'report-media-quarantine' and name = p_path;
  if v_object.id is null then
    raise exception 'media_not_uploaded' using errcode = 'P0002';
  end if;
  v_mime := v_object.metadata ->> 'mimetype';
  v_size := coalesce((v_object.metadata ->> 'size')::bigint, 0);
  if v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'media_type_not_allowed' using errcode = '22023';
  end if;
  if v_size < 1 or v_size > 8388608 then
    raise exception 'media_too_large' using errcode = '22023';
  end if;
  insert into public.alert_media (report_id, uploader_id, quarantine_path, mime_type, size_bytes)
  values (p_report_id, v_uid, p_path, v_mime, v_size::integer)
  on conflict (quarantine_path) do update set report_id = excluded.report_id
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Modération (modérateurs et administrateurs)
-- ---------------------------------------------------------------------
create or replace function private.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.admin_mfa_ok() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.moderate_approve_report(
  p_report_id uuid,
  p_mode text,
  p_event_id uuid,
  p_status public.verification_status,
  p_severity public.severity_level,
  p_public_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.alert_reports;
  v_event public.alert_events;
  v_event_id uuid;
  v_note text := nullif(btrim(coalesce(p_public_note, '')), '');
begin
  perform private.require_staff();
  if p_status not in ('under_review', 'corroborated', 'confirmed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select * into v_report from public.alert_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_report.moderation_status <> 'pending' then
    raise exception 'report_not_pending' using errcode = '55000';
  end if;
  if v_note is not null and private.contains_personal_contact(v_note) then
    raise exception 'personal_contact_not_allowed' using errcode = '22023';
  end if;

  perform set_config('app.change_reason', 'Validation du signalement ' || p_report_id::text, true);
  perform set_config('app.public_message', coalesce(v_note, ''), true);

  if p_mode = 'attach' then
    select * into v_event from public.alert_events where id = p_event_id for update;
    if v_event.id is null or v_event.status in ('rejected', 'archived') then
      raise exception 'event_not_found' using errcode = 'P0002';
    end if;
    if v_event.category_id <> v_report.category_id then
      raise exception 'category_mismatch' using errcode = '22023';
    end if;
    v_event_id := v_event.id;
    update public.alert_events
    set last_activity_at = now(),
        is_public = true,
        status = case when v_event.status = p_status then v_event.status
                      when private.status_strength(p_status) > private.status_strength(v_event.status) then p_status
                      else v_event.status end,
        severity = case when private.severity_rank(p_severity) > private.severity_rank(v_event.severity)
                        then p_severity else v_event.severity end,
        public_note = coalesce(v_note, v_event.public_note)
    where id = v_event_id;
    update public.alert_reports
    set moderation_status = 'merged', event_id = v_event_id, moderated_by = v_uid, moderated_at = now()
    where id = p_report_id;
    insert into public.report_moderation (report_id, moderator_id, action, event_id)
    values (p_report_id, v_uid, 'merge', v_event_id);
  elsif p_mode = 'new_event' then
    if v_report.event_id is not null then
      -- Événement publié automatiquement : on le fait évoluer au lieu d'en créer un second.
      v_event_id := v_report.event_id;
      update public.alert_events
      set status = p_status, severity = p_severity, is_public = true,
          public_note = coalesce(v_note, public_note)
      where id = v_event_id;
    else
      insert into public.alert_events (
        category_id, subcategory_id, status, severity, source_kind, is_public, location,
        location_uncertainty_m, started_at, created_by, public_note
      ) values (
        v_report.category_id, v_report.subcategory_id, p_status, p_severity, 'community', true,
        v_report.location, v_report.location_uncertainty_m, v_report.observed_at, v_uid, v_note
      ) returning id into v_event_id;
    end if;
    update public.alert_reports
    set moderation_status = 'approved', event_id = v_event_id, moderated_by = v_uid, moderated_at = now()
    where id = p_report_id;
    insert into public.report_moderation (report_id, moderator_id, action, event_id)
    values (p_report_id, v_uid, 'approve', v_event_id);
  else
    raise exception 'invalid_mode' using errcode = '22023';
  end if;

  insert into public.alert_verifications (event_id, report_id, verifier_id, method, verdict, note)
  values (v_event_id, p_report_id, v_uid, 'moderator_review', 'supports', null);

  update public.profiles set reputation = reputation + 2 where id = v_report.author_id;

  perform private.log_audit('report.approved', 'report', p_report_id::text,
    jsonb_build_object('event_id', v_event_id, 'mode', p_mode, 'status', p_status, 'severity', p_severity));
  return v_event_id;
end;
$$;

create or replace function public.moderate_reject_report(
  p_report_id uuid,
  p_reason public.rejection_reason,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_report public.alert_reports;
begin
  perform private.require_staff();
  select * into v_report from public.alert_reports where id = p_report_id for update;
  if v_report.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_report.moderation_status <> 'pending' then
    raise exception 'report_not_pending' using errcode = '55000';
  end if;

  update public.alert_reports
  set moderation_status = 'rejected', rejection_reason = p_reason, moderated_by = v_uid, moderated_at = now()
  where id = p_report_id;
  insert into public.report_moderation (report_id, moderator_id, action, reason, note)
  values (p_report_id, v_uid, 'reject', p_reason, nullif(btrim(coalesce(p_note, '')), ''));

  -- Événement publié automatiquement sans autre signalement : il est retiré.
  if v_report.event_id is not null and not exists (
    select 1 from public.alert_reports r
    where r.event_id = v_report.event_id and r.id <> p_report_id
      and r.moderation_status in ('pending', 'approved', 'merged')
  ) then
    perform set_config('app.change_reason', 'Signalement rejeté : ' || p_reason::text, true);
    update public.alert_events set status = 'rejected'
    where id = v_report.event_id and status in ('received', 'under_review');
  end if;

  if p_reason in ('false_or_misleading', 'abusive_content') then
    update public.profiles set reputation = reputation - 5 where id = v_report.author_id;
  end if;

  if v_report.author_id is not null then
    insert into public.user_notifications (user_id, kind, title, body, data, dedup_key)
    values (v_report.author_id, 'moderation', 'Signalement non publié',
            'Votre signalement n''a pas été publié. Vous pouvez contester cette décision.',
            jsonb_build_object('report_id', p_report_id, 'reason', p_reason),
            'moderation:' || p_report_id::text || ':rejected')
    on conflict (user_id, dedup_key) do nothing;
  end if;

  perform private.log_audit('report.rejected', 'report', p_report_id::text,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- Changement de statut / gravité / note d'un événement, avec justification obligatoire.
-- Les partenaires habilités peuvent uniquement confirmer ou clore.
create or replace function public.moderate_update_event(
  p_event_id uuid,
  p_status public.verification_status default null,
  p_severity public.severity_level default null,
  p_public_note text default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_event public.alert_events;
  v_is_staff boolean := private.is_staff();
  v_is_partner boolean := private.has_role('partner');
  v_note text := nullif(btrim(coalesce(p_public_note, '')), '');
begin
  if not v_is_staff and not v_is_partner then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not v_is_staff and (p_severity is not null or (p_status is not null and p_status not in ('confirmed', 'resolved'))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_note is not null and private.contains_personal_contact(v_note) then
    raise exception 'personal_contact_not_allowed' using errcode = '22023';
  end if;
  select * into v_event from public.alert_events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  perform set_config('app.change_reason', btrim(p_reason), true);
  perform set_config('app.public_message', coalesce(v_note, ''), true);

  update public.alert_events
  set status = coalesce(p_status, status),
      severity = coalesce(p_severity, severity),
      public_note = coalesce(v_note, public_note)
  where id = p_event_id;

  if p_status = 'confirmed' and v_event.status <> 'confirmed' then
    insert into public.alert_verifications (event_id, verifier_id, method, verdict, note)
    values (p_event_id, v_uid, case when v_is_staff then 'moderator_review' else 'partner' end,
            'supports', btrim(p_reason));
  end if;

  perform private.log_audit('event.updated', 'event', p_event_id::text,
    jsonb_build_object('status', p_status, 'severity', p_severity, 'reason', btrim(p_reason)));
end;
$$;

create or replace function public.moderate_set_event_visibility(p_event_id uuid, p_is_public boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  perform set_config('app.change_reason', btrim(p_reason), true);
  update public.alert_events set is_public = p_is_public where id = p_event_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.log_audit('event.visibility', 'event', p_event_id::text,
    jsonb_build_object('is_public', p_is_public, 'reason', btrim(p_reason)));
end;
$$;

-- Avis de vérification (contributeurs fiables, partenaires, équipe) : n'altère jamais le statut.
create or replace function public.add_event_verification(
  p_event_id uuid, p_verdict text, p_note text default null, p_evidence_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_method text;
  v_id uuid;
begin
  if private.is_staff() then
    v_method := 'moderator_review';
  elsif private.has_role('partner') then
    v_method := 'partner';
  elsif private.has_role('trusted_contributor') then
    v_method := 'trusted_contributor';
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.alert_events where id = p_event_id and is_public) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_note is not null and private.contains_personal_contact(p_note) then
    raise exception 'personal_contact_not_allowed' using errcode = '22023';
  end if;
  insert into public.alert_verifications (event_id, verifier_id, method, verdict, note, evidence_url)
  values (p_event_id, v_uid, v_method, p_verdict, nullif(btrim(coalesce(p_note, '')), ''), p_evidence_url)
  returning id into v_id;
  perform private.log_audit('event.verification_added', 'event', p_event_id::text,
    jsonb_build_object('verdict', p_verdict, 'method', v_method));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Contestations et signalements d'abus
-- ---------------------------------------------------------------------
create or replace function public.create_appeal(p_report_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if not exists (
    select 1 from public.alert_reports
    where id = p_report_id and author_id = v_uid and moderation_status = 'rejected'
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 1000 then
    raise exception 'message_invalid_length' using errcode = '22023';
  end if;
  insert into public.moderation_appeals (report_id, appellant_id, message)
  values (p_report_id, v_uid, btrim(p_message))
  returning id into v_id;
  perform private.log_audit('appeal.created', 'report', p_report_id::text, '{}'::jsonb);
  return v_id;
exception when unique_violation then
  raise exception 'appeal_already_open' using errcode = '23505';
end;
$$;

create or replace function public.decide_appeal(p_appeal_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_appeal public.moderation_appeals;
begin
  perform private.require_staff();
  select * into v_appeal from public.moderation_appeals where id = p_appeal_id for update;
  if v_appeal.id is null or v_appeal.status <> 'open' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.moderation_appeals
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decided_by = v_uid, decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_appeal_id;
  if p_accept then
    -- Le signalement retourne en file de modération pour un nouvel examen.
    update public.alert_reports
    set moderation_status = 'pending', rejection_reason = null, moderated_by = null, moderated_at = null
    where id = v_appeal.report_id;
  end if;
  insert into public.report_moderation (report_id, moderator_id, action, note)
  values (v_appeal.report_id, v_uid, case when p_accept then 'appeal_accepted' else 'appeal_rejected' end,
          nullif(btrim(coalesce(p_note, '')), ''));
  perform private.log_audit('appeal.decided', 'report', v_appeal.report_id::text,
    jsonb_build_object('accepted', p_accept));
end;
$$;

create or replace function public.create_abuse_report(
  p_target_type text, p_target_id uuid, p_reason text, p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if (select count(*) from public.abuse_reports where reporter_id = v_uid
      and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if p_target_type = 'event' and not exists (select 1 from public.alert_events where id = p_target_id and is_public)
     or p_target_type = 'assistance' and not exists (select 1 from public.community_assistance
                                                     where id = p_target_id and status = 'published')
     or p_target_type = 'report' and not exists (select 1 from public.alert_reports where id = p_target_id)
     or p_target_type not in ('event', 'assistance', 'report') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.abuse_reports (reporter_id, target_type, target_id, reason, details)
  values (v_uid, p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (reporter_id, target_type, target_id) do nothing;
end;
$$;

create or replace function public.handle_abuse_report(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  if p_status not in ('actioned', 'dismissed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.abuse_reports
  set status = p_status, handled_by = (select auth.uid()), handled_at = now()
  where id = p_id and status = 'open';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.log_audit('abuse.handled', 'abuse_report', p_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications et appareils
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.user_notifications
  set read_at = now()
  where user_id = (select auth.uid()) and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.register_push_token(
  p_kind text, p_platform text, p_token text, p_web_push_keys jsonb default null,
  p_locale public.locale_code default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_kind = 'expo' and p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if p_kind = 'webpush' and p_token !~ '^https://' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if (select count(*) from public.device_push_tokens where user_id = v_uid and enabled) >= 10 then
    raise exception 'device_limit_reached' using errcode = '54000';
  end if;
  -- Un appareil qui change de compte est réattribué au compte connecté.
  insert into public.device_push_tokens (user_id, kind, platform, token, web_push_keys, locale)
  values (v_uid, p_kind, p_platform, p_token, p_web_push_keys, p_locale)
  on conflict (token) do update
    set user_id = excluded.user_id, kind = excluded.kind, platform = excluded.platform,
        web_push_keys = excluded.web_push_keys, locale = excluded.locale,
        enabled = true, disabled_at = null, failure_count = 0, last_error = null, last_seen_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.device_push_tokens where token = p_token and user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Villages proposés par la communauté (validés par un modérateur)
-- ---------------------------------------------------------------------
create or replace function public.propose_village(p_name text, p_lat double precision, p_lng double precision)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_point extensions.geography;
  v_commune text;
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if char_length(v_name) not between 2 and 120 or private.contains_personal_contact(v_name) then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if (select count(*) from public.villages where proposed_by = v_uid
      and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  v_commune := private.commune_at(v_point);
  if v_commune is null then
    raise exception 'outside_coverage' using errcode = '22023';
  end if;
  insert into public.villages (commune_code, name_fr, location, source, status, proposed_by)
  values (v_commune, v_name, v_point, 'community', 'pending_review', v_uid)
  returning id into v_id;
  perform private.log_audit('village.proposed', 'village', v_id::text, jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

create or replace function public.review_village(p_village_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  update public.villages
  set status = case when p_approve then 'active' else 'rejected' end, reviewed_by = (select auth.uid())
  where id = p_village_id and status = 'pending_review';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.log_audit('village.reviewed', 'village', p_village_id::text,
    jsonb_build_object('approved', p_approve));
end;
$$;

-- ---------------------------------------------------------------------
-- Entraide
-- ---------------------------------------------------------------------
create or replace function public.create_assistance_post(
  p_kind text, p_title text, p_description text, p_commune_code text, p_expires_in_days integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if (select count(*) from public.community_assistance where author_id = v_uid
      and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if private.contains_personal_contact(coalesce(p_title, '') || ' ' || coalesce(p_description, '')) then
    raise exception 'personal_contact_not_allowed' using errcode = '22023';
  end if;
  if p_expires_in_days not between 1 and 30 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  insert into public.community_assistance (author_id, kind, title, description, commune_code, expires_at)
  values (v_uid, p_kind, btrim(p_title), btrim(p_description), p_commune_code,
          now() + make_interval(days => p_expires_in_days))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.moderate_assistance_post(
  p_id uuid, p_status text, p_verified_aid_point boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  if p_status not in ('published', 'rejected', 'closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.community_assistance
  set status = p_status, is_verified_public_aid_point = coalesce(p_verified_aid_point, false),
      moderated_by = (select auth.uid()), moderated_at = now()
  where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.log_audit('assistance.moderated', 'assistance', p_id::text, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.close_my_assistance_post(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.community_assistance set status = 'closed'
  where id = p_id and author_id = (select auth.uid()) and status in ('pending', 'published');
$$;

-- ---------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(
  p_user_id uuid, p_role public.app_role, p_grant boolean, p_reason text, p_organization text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform private.require_admin();
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_grant then
    insert into public.user_roles (user_id, role, organization, granted_by, reason)
    values (p_user_id, p_role, nullif(btrim(coalesce(p_organization, '')), ''), v_uid, btrim(p_reason))
    on conflict (user_id, role) do nothing;
  else
    if p_role = 'admin' and (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'last_admin' using errcode = '55000';
    end if;
    delete from public.user_roles where user_id = p_user_id and role = p_role;
    perform private.log_audit('role.revoke_reason', 'user', p_user_id::text,
      jsonb_build_object('role', p_role, 'reason', btrim(p_reason)));
  end if;
end;
$$;

create or replace function public.admin_set_suspension(p_user_id uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.profiles set is_suspended = p_suspended,
    suspended_reason = case when p_suspended then btrim(p_reason) else null end
  where id = p_user_id;
  perform private.log_audit(case when p_suspended then 'user.suspended' else 'user.unsuspended' end,
    'user', p_user_id::text, jsonb_build_object('reason', btrim(p_reason)));
end;
$$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.app_settings set value = p_value, updated_by = (select auth.uid()) where key = p_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'reports_pending', (select count(*) from public.alert_reports where moderation_status = 'pending'),
    'reports_24h', (select count(*) from public.alert_reports where created_at > now() - interval '24 hours'),
    'events_active', (select count(*) from public.alert_events
                      where is_public and not is_demo
                        and status in ('received', 'under_review', 'corroborated', 'confirmed')),
    'appeals_open', (select count(*) from public.moderation_appeals where status = 'open'),
    'abuse_open', (select count(*) from public.abuse_reports where status = 'open'),
    'media_quarantine', (select count(*) from public.alert_media where status = 'quarantine'),
    'villages_pending', (select count(*) from public.villages where status = 'pending_review'),
    'assistance_pending', (select count(*) from public.community_assistance where status = 'pending'),
    'by_category', (
      select coalesce(jsonb_object_agg(category_id, n), '{}'::jsonb)
      from (select category_id, count(*) as n from public.alert_events
            where is_public and not is_demo and created_at > now() - interval '30 days'
            group by category_id) s
    ),
    'generated_at', now()
  );
end;
$$;

-- Recherche d'utilisateurs pour la gestion des rôles (administrateurs uniquement).
create or replace function public.admin_find_users(p_query text, p_limit integer default 20)
returns table (
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, display_name text,
  reputation integer, is_suspended boolean, roles public.app_role[], reports_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, p.display_name, p.reputation, p.is_suspended,
           coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '{}'),
           (select count(*) from public.alert_reports ar where ar.author_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p_query is null or btrim(p_query) = ''
       or u.email ilike '%' || btrim(p_query) || '%'
       or p.display_name ilike '%' || btrim(p_query) || '%'
       or exists (select 1 from public.user_roles r where r.user_id = u.id and r.role::text = btrim(p_query))
    order by u.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- Journalisation par le serveur (rôle service), avec l'identité de l'acteur vérifiée côté route.
create or replace function public.service_log_audit(
  p_actor_id uuid, p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, actor_roles, action, target_type, target_id, metadata)
  values (
    p_actor_id,
    coalesce((select array_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = p_actor_id), '{}'),
    p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
-- Droits d'accès aux données personnelles : export
-- ---------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                                          'last_sign_in_at', u.last_sign_in_at)
                from auth.users u where u.id = (select auth.uid())),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('role', r.role, 'granted_at', r.granted_at)), '[]')
              from public.user_roles r where r.user_id = (select auth.uid())),
    'notification_preferences', (select to_jsonb(n) from public.notification_preferences n
                                 where n.user_id = (select auth.uid())),
    'followed_places', (select coalesce(jsonb_agg(jsonb_build_object(
                          'label', f.label, 'place_type', f.place_type, 'commune_code', f.commune_code,
                          'lat', extensions.st_y(f.location::extensions.geometry),
                          'lng', extensions.st_x(f.location::extensions.geometry),
                          'radius_m', f.radius_m, 'categories', f.categories, 'created_at', f.created_at)), '[]')
                        from public.user_followed_places f where f.user_id = (select auth.uid())),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', r.id, 'category', r.subcategory_id, 'description', r.description,
                  'lat', extensions.st_y(r.location::extensions.geometry),
                  'lng', extensions.st_x(r.location::extensions.geometry),
                  'observed_at', r.observed_at, 'status', r.moderation_status, 'created_at', r.created_at)), '[]')
                from public.alert_reports r where r.author_id = (select auth.uid())),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object(
                  'platform', d.platform, 'kind', d.kind, 'created_at', d.created_at,
                  'last_seen_at', d.last_seen_at)), '[]')
                from public.device_push_tokens d where d.user_id = (select auth.uid())),
    'notifications_count', (select count(*) from public.user_notifications n where n.user_id = (select auth.uid()))
  );
$$;

-- =====================================================================
-- Droits d'exécution
-- =====================================================================
grant execute on function public.events_in_bbox(double precision, double precision, double precision,
  double precision, text[], public.verification_status[], timestamptz, integer) to anon, authenticated;
grant execute on function public.events_near(double precision, double precision, integer, text[], boolean, integer)
  to anon, authenticated;
grant execute on function public.observations_in_bbox(double precision, double precision, double precision,
  double precision, text[], timestamptz, integer) to anon, authenticated;
grant execute on function public.my_followed_places_summary() to authenticated;
grant execute on function public.submit_report(uuid, text, text, text, double precision, double precision,
  public.location_precision, integer, timestamptz) to authenticated;
grant execute on function public.withdraw_report(uuid) to authenticated;
grant execute on function public.update_report_description(uuid, text) to authenticated;
grant execute on function public.register_report_media(uuid, text) to authenticated;
grant execute on function public.moderate_approve_report(uuid, text, uuid, public.verification_status,
  public.severity_level, text) to authenticated;
grant execute on function public.moderate_reject_report(uuid, public.rejection_reason, text) to authenticated;
grant execute on function public.moderate_update_event(uuid, public.verification_status, public.severity_level,
  text, text) to authenticated;
grant execute on function public.moderate_set_event_visibility(uuid, boolean, text) to authenticated;
grant execute on function public.add_event_verification(uuid, text, text, text) to authenticated;
grant execute on function public.create_appeal(uuid, text) to authenticated;
grant execute on function public.decide_appeal(uuid, boolean, text) to authenticated;
grant execute on function public.create_abuse_report(text, uuid, text, text) to authenticated;
grant execute on function public.handle_abuse_report(uuid, text) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.register_push_token(text, text, text, jsonb, public.locale_code) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.propose_village(text, double precision, double precision) to authenticated;
grant execute on function public.review_village(uuid, boolean) to authenticated;
grant execute on function public.create_assistance_post(text, text, text, text, integer) to authenticated;
grant execute on function public.moderate_assistance_post(uuid, text, boolean) to authenticated;
grant execute on function public.close_my_assistance_post(uuid) to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role, boolean, text, text) to authenticated;
grant execute on function public.admin_set_suspension(uuid, boolean, text) to authenticated;
grant execute on function public.admin_update_setting(text, jsonb) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_find_users(text, integer) to authenticated;
grant execute on function public.export_my_data() to authenticated;
revoke execute on function public.service_log_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
