-- =====================================================================
-- Alertes : catégories, sources, événements, signalements, médias,
-- vérifications, modération, contestations, signalements d'abus,
-- observations externes et journal de synchronisation.
--
-- Séparation stricte :
--   alert_reports       = signalement brut (jamais public tel quel)
--   alert_events        = événement public regroupant les observations (dédoublonnage)
--   alert_verifications = preuves / confirmations
--   notifications       = voir migration suivante
-- =====================================================================

create table public.alert_categories (
  id text primary key check (id ~ '^[a-z_]{2,40}$'),
  icon text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  priority smallint not null check (priority between 1 and 5),
  module text not null check (module in ('alerts', 'assistance')),
  -- Règles de validation (miroir de @tamurt/shared) : longueur min., ancienneté max., etc.
  validation_rules jsonb not null,
  -- Règles de notification : notifiable, statut minimal pour push, dédoublonnage.
  notification_rules jsonb not null,
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.alert_subcategories (
  id text primary key check (id ~ '^[a-z_]{2,40}\.[a-z_]{2,40}$'),
  category_id text not null references public.alert_categories (id),
  reportable boolean not null,
  default_severity public.severity_level not null,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  check (split_part(id, '.', 1) = category_id)
);
create index alert_subcategories_category on public.alert_subcategories (category_id);

-- Sources (communauté, sources externes) avec licence, attribution et état de synchronisation.
create table public.alert_sources (
  id text primary key check (id ~ '^[a-z_]{2,40}$'),
  name text not null,
  kind public.source_kind not null,
  homepage_url text,
  documentation_url text,
  license text not null,
  attribution text not null,
  requires_key boolean not null default false,
  enabled boolean not null default false,
  sync_interval_minutes integer check (sync_interval_minutes is null or sync_interval_minutes >= 5),
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  circuit_open_until timestamptz,
  updated_at timestamptz not null default now()
);
create trigger alert_sources_updated_at before update on public.alert_sources
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Événements publics
-- ---------------------------------------------------------------------
create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.alert_categories (id),
  subcategory_id text not null references public.alert_subcategories (id),
  status public.verification_status not null default 'received',
  severity public.severity_level not null default 'information',
  source_kind public.source_kind not null default 'community',
  is_public boolean not null default false,
  is_demo boolean not null default false,
  location extensions.geography(Point, 4326) not null,
  location_uncertainty_m integer not null default 0 check (location_uncertainty_m between 0 and 50000),
  commune_code text references public.communes (code),
  wilaya_code text references public.wilayas (code),
  public_note text check (public_note is null or char_length(public_note) <= 500),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_activity_at timestamptz not null default now(),
  report_count integer not null default 0,
  external_source_id text references public.alert_sources (id),
  external_ref text,
  external_url text,
  magnitude numeric(3, 1),
  depth_km numeric(6, 1),
  details jsonb not null default '{}'::jsonb,
  -- Incrémentée à chaque changement notable (statut, gravité, publication) : sert de clé de déduplication.
  version integer not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subcategory_id like category_id || '.%'),
  check (ended_at is null or ended_at >= started_at)
);
create unique index alert_events_external_ref on public.alert_events (external_source_id, external_ref)
  where external_ref is not null;
create index alert_events_location_gix on public.alert_events using gist (location);
create index alert_events_location_geom_gix on public.alert_events using gist ((location::extensions.geometry));
create index alert_events_public_active on public.alert_events (last_activity_at desc)
  where is_public and status in ('received', 'under_review', 'corroborated', 'confirmed');
create index alert_events_category_status on public.alert_events (category_id, status);
create index alert_events_commune on public.alert_events (commune_code);

-- Historique traçable des changements (statut, gravité, notes).
create table public.alert_event_updates (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.alert_events (id) on delete cascade,
  kind text not null check (kind in ('created', 'status_change', 'severity_change', 'published',
                                     'unpublished', 'note', 'merge', 'location_change')),
  old_status public.verification_status,
  new_status public.verification_status,
  old_severity public.severity_level,
  new_severity public.severity_level,
  message text check (message is null or char_length(message) <= 500),
  -- Justification interne (non publique).
  reason text check (reason is null or char_length(reason) <= 500),
  is_public boolean not null default true,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index alert_event_updates_event on public.alert_event_updates (event_id, created_at);

-- ---------------------------------------------------------------------
-- Signalements bruts
-- ---------------------------------------------------------------------
create table public.alert_reports (
  id uuid primary key default gen_random_uuid(),
  -- NULL après suppression du compte (signalement anonymisé).
  author_id uuid references auth.users (id) on delete set null,
  client_id uuid not null,
  category_id text not null references public.alert_categories (id),
  subcategory_id text not null references public.alert_subcategories (id),
  description text not null check (char_length(description) between 1 and 2000),
  -- Position du PHÉNOMÈNE, pas celle du téléphone.
  location extensions.geography(Point, 4326) not null,
  location_precision public.location_precision not null,
  location_uncertainty_m integer not null check (location_uncertainty_m between 0 and 20000),
  commune_code text references public.communes (code),
  wilaya_code text references public.wilayas (code),
  observed_at timestamptz not null,
  moderation_status public.moderation_status not null default 'pending',
  event_id uuid references public.alert_events (id) on delete set null,
  rejection_reason public.rejection_reason,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  withdrawn_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, client_id),
  check (subcategory_id like category_id || '.%'),
  check (moderation_status <> 'rejected' or rejection_reason is not null)
);
create index alert_reports_pending on public.alert_reports (created_at) where moderation_status = 'pending';
create index alert_reports_author on public.alert_reports (author_id, created_at desc);
create index alert_reports_event on public.alert_reports (event_id);
create index alert_reports_location_gix on public.alert_reports using gist (location);
create trigger alert_reports_updated_at before update on public.alert_reports
  for each row execute function private.set_updated_at();

-- Médias joints (photos). Le fichier brut reste en quarantaine (bucket privé) jusqu'à
-- modération ; seule une copie ré-encodée sans métadonnées EXIF est publiée.
create table public.alert_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.alert_reports (id) on delete cascade,
  -- Renseigné à la publication : permet l'affichage public sans exposer le signalement brut.
  event_id uuid references public.alert_events (id) on delete set null,
  uploader_id uuid references auth.users (id) on delete set null,
  quarantine_path text not null unique,
  public_path text unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 8388608),
  width integer,
  height integer,
  sha256 text,
  status text not null default 'quarantine'
    check (status in ('quarantine', 'approved', 'rejected', 'processing_failed')),
  exif_stripped boolean not null default false,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);
create index alert_media_report on public.alert_media (report_id);
create index alert_media_event on public.alert_media (event_id) where status = 'approved';
create index alert_media_quarantine on public.alert_media (created_at) where status = 'quarantine';

-- Preuves et confirmations rattachées à un événement.
create table public.alert_verifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.alert_events (id) on delete cascade,
  report_id uuid references public.alert_reports (id) on delete set null,
  verifier_id uuid references auth.users (id) on delete set null,
  method text not null check (method in ('moderator_review', 'trusted_contributor', 'official_source',
                                         'partner', 'satellite_correlation', 'multiple_reports',
                                         'seismic_network')),
  verdict text not null check (verdict in ('supports', 'contradicts', 'inconclusive')),
  evidence_url text check (evidence_url is null or evidence_url ~ '^https://'),
  external_observation_id uuid,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index alert_verifications_event on public.alert_verifications (event_id);

-- Journal des décisions de modération sur les signalements.
create table public.report_moderation (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.alert_reports (id) on delete cascade,
  moderator_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('approve', 'merge', 'reject', 'restore', 'appeal_accepted',
                                         'appeal_rejected')),
  reason public.rejection_reason,
  note text check (note is null or char_length(note) <= 500),
  event_id uuid references public.alert_events (id) on delete set null,
  created_at timestamptz not null default now()
);
create index report_moderation_report on public.report_moderation (report_id);

create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.alert_reports (id) on delete cascade,
  appellant_id uuid references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  created_at timestamptz not null default now()
);
create unique index moderation_appeals_one_open on public.moderation_appeals (report_id)
  where status = 'open';

-- Signalements de contenus abusifs (sur un événement, un signalement ou une annonce d'entraide).
create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('event', 'report', 'assistance')),
  target_id uuid not null,
  reason text not null check (reason in ('false_information', 'personal_data', 'hateful_or_violent',
                                         'spam', 'inappropriate_media', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index abuse_reports_unique on public.abuse_reports (reporter_id, target_type, target_id);
create index abuse_reports_open on public.abuse_reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------
-- Sources externes : observations normalisées et journal de synchronisation
-- ---------------------------------------------------------------------
create table public.external_observations (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.alert_sources (id),
  external_id text not null,
  kind text not null check (kind in ('earthquake', 'thermal_hotspot', 'weather_forecast', 'weather_warning')),
  location extensions.geography(Point, 4326) not null,
  observed_at timestamptz not null,
  magnitude numeric(3, 1),
  depth_km numeric(6, 1),
  confidence text,
  title text,
  payload jsonb not null default '{}'::jsonb,
  event_id uuid references public.alert_events (id) on delete set null,
  is_demo boolean not null default false,
  fetched_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index external_observations_location_gix on public.external_observations using gist (location);
create index external_observations_geom_gix on public.external_observations
  using gist ((location::extensions.geometry));
create index external_observations_kind_time on public.external_observations (kind, observed_at desc);

alter table public.alert_verifications
  add constraint alert_verifications_observation_fk
  foreign key (external_observation_id) references public.external_observations (id) on delete set null;

create table public.api_sync_runs (
  id bigint generated always as identity primary key,
  source_id text not null references public.alert_sources (id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  items_fetched integer not null default 0,
  items_upserted integer not null default 0,
  events_created integer not null default 0,
  http_status integer,
  error text check (error is null or char_length(error) <= 2000),
  duration_ms integer,
  trigger text not null default 'schedule' check (trigger in ('schedule', 'manual', 'test'))
);
create index api_sync_runs_source_time on public.api_sync_runs (source_id, started_at desc);

-- =====================================================================
-- Triggers métier sur les événements
-- =====================================================================

-- Contrôles d'intégrité : plafond de gravité, cohérence géographique, transitions, version.
create or replace function private.alert_events_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap public.severity_level := private.max_severity_for_status(new.status);
  v_sub public.alert_subcategories;
begin
  if private.severity_rank(new.severity) > private.severity_rank(v_cap) then
    raise exception 'severity_exceeds_status_cap: % > % pour le statut %', new.severity, v_cap, new.status
      using errcode = 'check_violation';
  end if;

  select * into v_sub from public.alert_subcategories s where s.id = new.subcategory_id;
  if v_sub.category_id is distinct from new.category_id then
    raise exception 'subcategory_mismatch' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' or new.location is distinct from old.location then
    new.commune_code := coalesce(private.commune_at(new.location),
                                 case when tg_op = 'UPDATE' then null else new.commune_code end);
    new.wilaya_code := (select c.wilaya_code from public.communes c where c.code = new.commune_code);
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if not (
        (old.status = 'received' and new.status in ('under_review', 'corroborated', 'confirmed', 'rejected'))
        or (old.status = 'under_review' and new.status in ('corroborated', 'confirmed', 'rejected', 'resolved'))
        or (old.status = 'corroborated' and new.status in ('under_review', 'confirmed', 'rejected', 'resolved'))
        or (old.status = 'confirmed' and new.status in ('resolved', 'corroborated'))
        or (old.status = 'rejected' and new.status = 'under_review')
        or (old.status = 'resolved' and new.status in ('archived', 'under_review', 'confirmed'))
      ) then
        raise exception 'invalid_status_transition: % -> %', old.status, new.status
          using errcode = 'check_violation';
      end if;
      if new.status = 'resolved' and new.ended_at is null then
        new.ended_at := now();
      end if;
      if new.status in ('rejected') then
        new.is_public := false;
      end if;
    end if;
    if new.status is distinct from old.status
       or new.severity is distinct from old.severity
       or new.is_public is distinct from old.is_public then
      new.version := old.version + 1;
      new.last_activity_at := now();
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger alert_events_before_write before insert or update on public.alert_events
  for each row execute function private.alert_events_before_write();

-- Historique automatique. La justification est transmise par la variable de session
-- « app.change_reason » (positionnée par les fonctions de modération).
create or replace function private.alert_events_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(current_setting('app.change_reason', true), '');
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.alert_event_updates (event_id, kind, new_status, new_severity, author_id, is_public, reason)
    values (new.id, 'created', new.status, new.severity, coalesce(v_actor, new.created_by), true, v_reason);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.alert_event_updates (event_id, kind, old_status, new_status, author_id, reason, message)
    values (new.id, 'status_change', old.status, new.status, v_actor, v_reason,
            nullif(current_setting('app.public_message', true), ''));
  end if;
  if new.severity is distinct from old.severity then
    insert into public.alert_event_updates (event_id, kind, old_severity, new_severity, author_id, reason)
    values (new.id, 'severity_change', old.severity, new.severity, v_actor, v_reason);
  end if;
  if new.is_public is distinct from old.is_public then
    insert into public.alert_event_updates (event_id, kind, author_id, reason, is_public)
    values (new.id, case when new.is_public then 'published' else 'unpublished' end, v_actor, v_reason, false);
  end if;
  if new.public_note is distinct from old.public_note and new.public_note is not null then
    insert into public.alert_event_updates (event_id, kind, message, author_id, reason)
    values (new.id, 'note', new.public_note, v_actor, v_reason);
  end if;
  return new;
end;
$$;

create trigger alert_events_history after insert or update on public.alert_events
  for each row execute function private.alert_events_history();

-- Nombre d'auteurs DISTINCTS rattachés à un événement (un auteur ne peut pas gonfler le compteur).
create or replace function private.refresh_event_report_count(p_event_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.alert_events e
  set report_count = (
    select count(distinct coalesce(r.author_id::text, r.id::text))
    from public.alert_reports r
    where r.event_id = p_event_id and r.moderation_status in ('pending', 'approved', 'merged')
  )
  where e.id = p_event_id;
$$;

create or replace function private.alert_reports_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.event_id is not null and old.event_id is distinct from new.event_id then
    perform private.refresh_event_report_count(old.event_id);
  end if;
  if new.event_id is not null then
    perform private.refresh_event_report_count(new.event_id);
  end if;
  return new;
end;
$$;

create trigger alert_reports_after_write after insert or update of event_id, moderation_status
  on public.alert_reports
  for each row execute function private.alert_reports_after_write();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.alert_categories enable row level security;
alter table public.alert_subcategories enable row level security;
alter table public.alert_sources enable row level security;
alter table public.alert_events enable row level security;
alter table public.alert_event_updates enable row level security;
alter table public.alert_reports enable row level security;
alter table public.alert_media enable row level security;
alter table public.alert_verifications enable row level security;
alter table public.report_moderation enable row level security;
alter table public.moderation_appeals enable row level security;
alter table public.abuse_reports enable row level security;
alter table public.external_observations enable row level security;
alter table public.api_sync_runs enable row level security;

-- Catalogue : lecture publique.
grant select on public.alert_categories, public.alert_subcategories to anon, authenticated;
create policy alert_categories_read on public.alert_categories for select to anon, authenticated using (true);
create policy alert_subcategories_read on public.alert_subcategories for select to anon, authenticated using (true);

-- Sources : seules les colonnes publiques (nom, licence, attribution, fraîcheur) sont lisibles.
-- La configuration et les messages d'erreur ne sont accessibles que côté serveur (rôle service),
-- après vérification du rôle administrateur par la route d'administration.
grant select (id, name, kind, homepage_url, documentation_url, license, attribution, requires_key,
              enabled, sync_interval_minutes, last_sync_at, last_success_at)
  on public.alert_sources to anon, authenticated;
create policy alert_sources_read on public.alert_sources for select to anon, authenticated using (true);

-- Événements : lecture publique des événements publiés (hors démo si le mode démo est inactif).
grant select on public.alert_events to anon, authenticated;
create policy alert_events_public_read on public.alert_events for select to anon, authenticated
  using (
    (is_public and status <> 'rejected' and (not is_demo or (select private.demo_mode_enabled())))
    or (select private.is_staff())
    or ((select private.has_role('partner')) and not is_demo)
  );

grant select on public.alert_event_updates to anon, authenticated;
create policy alert_event_updates_read on public.alert_event_updates for select to anon, authenticated
  using (
    (select private.is_staff())
    or (
      is_public
      and exists (
        select 1 from public.alert_events e
        where e.id = event_id and e.is_public and e.status <> 'rejected'
          and (not e.is_demo or (select private.demo_mode_enabled()))
      )
    )
  );

-- Signalements bruts : visibles par leur auteur et l'équipe de modération uniquement.
-- Aucune écriture directe : soumission via public.submit_report().
grant select on public.alert_reports to authenticated;
create policy alert_reports_read_own_or_staff on public.alert_reports for select to authenticated
  using (author_id = (select auth.uid()) or (select private.is_staff()));

grant select on public.alert_media to anon, authenticated;
create policy alert_media_read on public.alert_media for select to anon, authenticated
  using (
    uploader_id = (select auth.uid())
    or (select private.is_staff())
    or (
      status = 'approved'
      and event_id is not null
      -- La RLS de alert_events s'applique aussi ici (événements publics uniquement).
      and exists (select 1 from public.alert_events e where e.id = event_id and e.is_public
                  and e.status <> 'rejected')
    )
  );

grant select on public.alert_verifications to anon, authenticated;
create policy alert_verifications_read on public.alert_verifications for select to anon, authenticated
  using (
    (select private.is_staff())
    or exists (select 1 from public.alert_events e where e.id = event_id and e.is_public
               and e.status <> 'rejected' and (not e.is_demo or (select private.demo_mode_enabled())))
  );

grant select on public.report_moderation to authenticated;
create policy report_moderation_read on public.report_moderation for select to authenticated
  using (
    (select private.is_staff())
    or exists (select 1 from public.alert_reports r where r.id = report_id and r.author_id = (select auth.uid()))
  );

grant select on public.moderation_appeals to authenticated;
create policy moderation_appeals_read on public.moderation_appeals for select to authenticated
  using (appellant_id = (select auth.uid()) or (select private.is_staff()));

grant select on public.abuse_reports to authenticated;
create policy abuse_reports_read on public.abuse_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_staff()));

grant select on public.external_observations to anon, authenticated;
create policy external_observations_read on public.external_observations for select to anon, authenticated
  using (not is_demo or (select private.demo_mode_enabled()) or (select private.is_staff()));

grant select on public.api_sync_runs to authenticated;
create policy api_sync_runs_admin_read on public.api_sync_runs for select to authenticated
  using ((select private.is_admin()));
