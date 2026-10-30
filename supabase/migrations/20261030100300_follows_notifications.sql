-- =====================================================================
-- Mes villages (lieux suivis), préférences de notification, appareils,
-- boîte de réception, remises (deliveries) et outbox transactionnelle.
-- =====================================================================

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  web_push_enabled boolean not null default false,
  min_severity public.severity_level not null default 'vigilance',
  include_unverified boolean not null default false,
  updates_enabled boolean not null default true,
  resolution_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  timezone text not null default 'Africa/Algiers' check (char_length(timezone) between 1 and 64),
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

-- Préférences par défaut créées avec le profil.
create or replace function private.create_default_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger profiles_default_preferences after insert on public.profiles
  for each row execute function private.create_default_preferences();

-- ---------------------------------------------------------------------
-- Lieux suivis (« Mes villages ») — pas de géolocalisation continue nécessaire
-- ---------------------------------------------------------------------
create table public.user_followed_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  place_type text not null check (place_type in ('commune', 'village', 'custom')),
  commune_code text references public.communes (code),
  village_id uuid references public.villages (id) on delete set null,
  location extensions.geography(Point, 4326) not null,
  radius_m integer not null default 5000 check (radius_m between 500 and 30000),
  -- Vide = toutes les catégories.
  categories text[] not null default '{}',
  notify boolean not null default true,
  min_severity public.severity_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_followed_places_user on public.user_followed_places (user_id);
create index user_followed_places_location_gix on public.user_followed_places using gist (location);

create or replace function private.followed_places_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_village public.villages;
begin
  if tg_op = 'INSERT' then
    select count(*) into v_count from public.user_followed_places where user_id = new.user_id;
    if v_count >= 20 then
      raise exception 'followed_places_limit_reached' using errcode = 'check_violation';
    end if;
  end if;

  if new.place_type = 'commune' then
    if new.commune_code is null then
      raise exception 'commune_required' using errcode = 'check_violation';
    end if;
    select c.centroid into new.location from public.communes c where c.code = new.commune_code;
    if new.location is null then
      raise exception 'unknown_commune' using errcode = 'foreign_key_violation';
    end if;
    new.village_id := null;
  elsif new.place_type = 'village' then
    select * into v_village from public.villages v where v.id = new.village_id and v.status = 'active';
    if v_village.id is null then
      raise exception 'unknown_village' using errcode = 'foreign_key_violation';
    end if;
    new.location := v_village.location;
    new.commune_code := v_village.commune_code;
  else
    new.village_id := null;
    new.commune_code := private.commune_at(new.location);
    if new.commune_code is null then
      -- Honnêteté de couverture : on ne propose pas de suivre une zone sans référentiel.
      raise exception 'outside_coverage' using errcode = 'check_violation';
    end if;
  end if;

  if exists (
    select 1 from unnest(new.categories) as c(id)
    where not exists (select 1 from public.alert_categories ac where ac.id = c.id)
  ) then
    raise exception 'unknown_category' using errcode = 'check_violation';
  end if;
  new.categories := array(select distinct unnest(new.categories) order by 1);
  return new;
end;
$$;
create trigger user_followed_places_before_write before insert or update on public.user_followed_places
  for each row execute function private.followed_places_before_write();
create trigger user_followed_places_updated_at before update on public.user_followed_places
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Appareils (jetons Expo Push ou abonnements Web Push)
-- ---------------------------------------------------------------------
create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('expo', 'webpush')),
  platform text not null check (platform in ('ios', 'android', 'web')),
  -- Jeton Expo (ExponentPushToken[…]) ou URL d'abonnement Web Push.
  token text not null unique check (char_length(token) between 10 and 1000),
  web_push_keys jsonb,
  locale public.locale_code,
  enabled boolean not null default true,
  failure_count integer not null default 0,
  last_error text,
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'webpush' or (web_push_keys ? 'p256dh' and web_push_keys ? 'auth'))
);
create index device_push_tokens_user on public.device_push_tokens (user_id) where enabled;

-- ---------------------------------------------------------------------
-- Boîte de réception et remises
-- ---------------------------------------------------------------------
create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.alert_events (id) on delete cascade,
  kind text not null check (kind in ('event', 'test', 'moderation', 'system')),
  reason text check (reason is null or reason in ('published', 'status_upgraded', 'severity_raised', 'resolved')),
  title text not null check (char_length(title) <= 200),
  body text not null check (char_length(body) <= 1000),
  severity public.severity_level,
  data jsonb not null default '{}'::jsonb,
  dedup_key text not null,
  channel text not null default 'inbox_only' check (channel in ('push', 'inbox_only')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);
create index user_notifications_user_time on public.user_notifications (user_id, created_at desc);
create index user_notifications_unread on public.user_notifications (user_id) where read_at is null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.user_notifications (id) on delete cascade,
  device_token_id uuid references public.device_push_tokens (id) on delete set null,
  channel text not null check (channel in ('expo', 'webpush')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'invalid_token', 'skipped')),
  provider_ticket_id text,
  error text check (error is null or char_length(error) <= 1000),
  attempt integer not null default 1,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_deliveries_notification on public.notification_deliveries (notification_id);
create index notification_deliveries_pending_receipts on public.notification_deliveries (created_at)
  where status = 'sent' and channel = 'expo' and receipt_checked_at is null;
create trigger notification_deliveries_updated_at before update on public.notification_deliveries
  for each row execute function private.set_updated_at();

-- Outbox : écrite dans la même transaction que le changement d'événement.
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.alert_events (id) on delete cascade,
  reason text not null check (reason in ('published', 'status_upgraded', 'severity_raised', 'resolved')),
  event_version integer not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  recipients_count integer,
  push_count integer,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (event_id, reason, event_version)
);
create index notification_outbox_pending on public.notification_outbox (created_at) where status in ('pending', 'failed');

create or replace function private.alert_events_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  if new.is_demo or not new.is_public or new.status in ('rejected', 'archived') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'resolved' then v_reason := 'published'; end if;
  elsif not old.is_public then
    if new.status <> 'resolved' then v_reason := 'published'; end if;
  elsif new.status = 'resolved' and old.status <> 'resolved' then
    v_reason := 'resolved';
  elsif private.status_strength(new.status) > private.status_strength(old.status)
        and private.status_strength(new.status) >= 2 then
    v_reason := 'status_upgraded';
  elsif private.severity_rank(new.severity) > private.severity_rank(old.severity) then
    v_reason := 'severity_raised';
  end if;

  if v_reason is not null then
    insert into public.notification_outbox (event_id, reason, event_version)
    values (new.id, v_reason, new.version)
    on conflict (event_id, reason, event_version) do nothing;
  end if;
  return new;
end;
$$;
create trigger alert_events_outbox after insert or update on public.alert_events
  for each row execute function private.alert_events_outbox();

-- Candidats géographiques d'une notification (le filtre fin — catégories, gravité,
-- heures silencieuses, anti-spam — est appliqué par le serveur avec @tamurt/shared).
create or replace function public.notification_candidates(p_event_id uuid)
returns table (
  user_id uuid,
  followed_place_id uuid,
  place_label text,
  distance_m double precision,
  place_categories text[],
  place_min_severity public.severity_level,
  place_notify boolean,
  push_enabled boolean,
  web_push_enabled boolean,
  min_severity public.severity_level,
  include_unverified boolean,
  updates_enabled boolean,
  resolution_enabled boolean,
  quiet_hours_enabled boolean,
  quiet_hours_start text,
  quiet_hours_end text,
  timezone text,
  locale public.locale_code
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.user_id, f.id, f.label,
         extensions.st_distance(f.location, e.location),
         f.categories, f.min_severity, f.notify,
         p.push_enabled, p.web_push_enabled, p.min_severity, p.include_unverified,
         p.updates_enabled, p.resolution_enabled, p.quiet_hours_enabled,
         to_char(p.quiet_hours_start, 'HH24:MI'), to_char(p.quiet_hours_end, 'HH24:MI'),
         p.timezone, pr.preferred_locale
  from public.alert_events e
  join public.user_followed_places f
    on (f.place_type = 'commune' and f.commune_code = e.commune_code)
       or extensions.st_dwithin(f.location, e.location, f.radius_m + least(e.location_uncertainty_m, 5000))
  join public.notification_preferences p on p.user_id = f.user_id
  join public.profiles pr on pr.id = f.user_id and not pr.is_suspended
  where e.id = p_event_id and e.is_public and not e.is_demo
  order by f.user_id, extensions.st_distance(f.location, e.location);
$$;

-- Échec d'envoi transitoire : compteur ; au-delà de 10 échecs, l'appareil est désactivé.
create or replace function public.increment_token_failure(p_token_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.device_push_tokens
  set failure_count = failure_count + 1,
      last_error = left(coalesce(p_error, ''), 500),
      enabled = case when failure_count + 1 >= 10 then false else enabled end,
      disabled_at = case when failure_count + 1 >= 10 then now() else disabled_at end
  where id = p_token_id;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.notification_preferences enable row level security;
alter table public.user_followed_places enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_outbox enable row level security;

grant select, update on public.notification_preferences to authenticated;
create policy notification_preferences_own_read on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_own_update on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.user_followed_places to authenticated;
create policy followed_places_own_read on public.user_followed_places
  for select to authenticated using (user_id = (select auth.uid()));
create policy followed_places_own_insert on public.user_followed_places
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy followed_places_own_update on public.user_followed_places
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy followed_places_own_delete on public.user_followed_places
  for delete to authenticated using (user_id = (select auth.uid()));

-- Jetons : lecture / suppression par le propriétaire ; enregistrement via register_push_token().
grant select, delete on public.device_push_tokens to authenticated;
create policy device_tokens_own_read on public.device_push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy device_tokens_own_delete on public.device_push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- Boîte de réception : lecture par le destinataire ; marquage « lu » via mark_notifications_read().
grant select on public.user_notifications to authenticated;
create policy user_notifications_own_read on public.user_notifications
  for select to authenticated using (user_id = (select auth.uid()));

-- Remises : administrateurs (historique) ; écriture réservée au serveur (rôle service).
grant select on public.notification_deliveries to authenticated;
create policy notification_deliveries_admin_read on public.notification_deliveries
  for select to authenticated using ((select private.is_admin()));

grant select on public.notification_outbox to authenticated;
create policy notification_outbox_admin_read on public.notification_outbox
  for select to authenticated using ((select private.is_admin()));

revoke execute on function public.notification_candidates(uuid) from public, anon, authenticated;
revoke execute on function public.increment_token_failure(uuid, text) from public, anon, authenticated;
