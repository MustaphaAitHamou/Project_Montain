-- =====================================================================
-- Tamurt Alerte — fondations : extensions, schéma privé, types, profils,
-- rôles, journal d'audit, paramètres applicatifs.
-- =====================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schéma non exposé par l'API (PostgREST n'expose que public / graphql_public).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
-- Les fonctions privées ne sont exécutables que si on l'autorise explicitement.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- Types énumérés (ensembles stables, synchronisés avec @tamurt/shared)
-- ---------------------------------------------------------------------
create type public.app_role as enum ('trusted_contributor', 'moderator', 'admin', 'partner');
create type public.severity_level as enum ('information', 'vigilance', 'important', 'critical');
create type public.verification_status as enum (
  'received', 'under_review', 'corroborated', 'confirmed', 'rejected', 'resolved', 'archived'
);
create type public.moderation_status as enum ('pending', 'approved', 'merged', 'rejected', 'withdrawn');
create type public.rejection_reason as enum (
  'insufficient_information', 'outside_coverage', 'duplicate', 'false_or_misleading',
  'abusive_content', 'personal_data', 'not_an_alert', 'other'
);
create type public.source_kind as enum ('community', 'official', 'seismic', 'satellite', 'forecast');
create type public.location_precision as enum ('exact', 'approximate', 'uncertain');
create type public.locale_code as enum ('fr', 'kab', 'ar');

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.severity_rank(s public.severity_level)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case s
    when 'information' then 0
    when 'vigilance' then 1
    when 'important' then 2
    when 'critical' then 3
  end;
$$;

-- Plafond de gravité selon le statut de vérification (miroir de @tamurt/shared).
-- Aucun plafond pour rejected / resolved / archived : ces événements ne sont plus
-- présentés comme une alerte en cours (un rejeté est masqué).
create or replace function private.max_severity_for_status(st public.verification_status)
returns public.severity_level
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case st
    when 'received' then 'vigilance'::public.severity_level
    when 'under_review' then 'vigilance'::public.severity_level
    when 'corroborated' then 'important'::public.severity_level
    else 'critical'::public.severity_level
  end;
$$;

create or replace function private.status_strength(st public.verification_status)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case st
    when 'received' then 0
    when 'under_review' then 1
    when 'corroborated' then 2
    when 'confirmed' then 3
    else -1
  end;
$$;

-- Détection prudente de coordonnées personnelles (e-mail, suite de ≥ 9 chiffres).
create or replace function private.contains_personal_contact(t text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select t ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
      or t ~ '(\+?[0-9][ .-]?){9,}';
$$;

-- unaccent IMMUABLE (indexable) et normalisation des noms de lieux kabyles :
-- « Aït / Ath / At / Aith / Beni » → « at » ; « Nath / N'Aït / Naït » → « n at ».
-- Ex. « Larbaa N'Aït Irathen » et « Larbaâ Nath Irathen » ont la même forme normalisée.
create or replace function private.immutable_unaccent(t text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, t);
$$;

create or replace function private.normalize_place_name(t text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(private.immutable_unaccent(t)), '[''’`\-_.,()]', ' ', 'g'),
        '\mn(aith|ait|ath)\M', 'n at', 'g'),
      '\m(aith|ait|ath|at|beni)\M', 'at', 'g'),
    '\s+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------
-- Profils (données minimales : aucun téléphone, aucune adresse)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 40),
  preferred_locale public.locale_code not null default 'fr',
  -- Score indicatif calculé à partir des décisions de modération ; ne donne aucun droit.
  reputation integer not null default 0,
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'Profil applicatif minimal. La réputation est indicative et n''attribue jamais de rôle automatiquement.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Rôles (attribués explicitement par un administrateur)
-- ---------------------------------------------------------------------
create table public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  organization text check (organization is null or char_length(organization) <= 120),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  reason text
);
create unique index user_roles_unique on public.user_roles (user_id, role);

-- Fonctions de contrôle d'accès (SECURITY DEFINER : lisent user_roles sans dépendre de la RLS).
create or replace function private.has_role(r public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = r
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role in ('moderator', 'admin')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin');
$$;

-- ---------------------------------------------------------------------
-- Paramètres applicatifs
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function private.setting(k text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.app_settings where key = k;
$$;

create or replace function private.demo_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting('demo_mode'))::boolean, false);
$$;

-- MFA administrateur : si exigé, le jeton doit être de niveau aal2 (TOTP vérifié).
create or replace function private.admin_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not coalesce((private.setting('require_admin_mfa'))::boolean, false)
      or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

-- ---------------------------------------------------------------------
-- Journal d'audit (append-only)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_roles public.app_role[] not null default '{}',
  action text not null check (char_length(action) <= 80),
  target_type text not null check (char_length(target_type) <= 40),
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at on public.audit_logs (created_at desc);
create index audit_logs_target on public.audit_logs (target_type, target_id);
create index audit_logs_actor on public.audit_logs (actor_id);

create or replace function private.log_audit(
  p_action text, p_target_type text, p_target_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  insert into public.audit_logs (actor_id, actor_roles, action, target_type, target_id, metadata)
  values (
    v_actor,
    coalesce((select array_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = v_actor), '{}'),
    p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Toute modification des rôles est tracée, quelle que soit la voie (RPC ou SQL direct).
create or replace function private.audit_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit('role.granted', 'user', new.user_id::text,
      jsonb_build_object('role', new.role, 'organization', new.organization, 'reason', new.reason));
    return new;
  elsif tg_op = 'DELETE' then
    perform private.log_audit('role.revoked', 'user', old.user_id::text, jsonb_build_object('role', old.role));
    return old;
  end if;
  return new;
end;
$$;
create trigger user_roles_audit after insert or delete on public.user_roles
  for each row execute function private.audit_user_roles();

create or replace function private.audit_app_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log_audit('setting.updated', 'app_setting', new.key,
    jsonb_build_object('old', case when tg_op = 'UPDATE' then old.value end, 'new', new.value));
  return new;
end;
$$;
create trigger app_settings_audit after insert or update on public.app_settings
  for each row execute function private.audit_app_settings();
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale public.locale_code := 'fr';
  v_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if (new.raw_user_meta_data ->> 'preferred_locale') in ('fr', 'kab', 'ar') then
    v_locale := (new.raw_user_meta_data ->> 'preferred_locale')::public.locale_code;
  end if;
  if v_name is not null and char_length(v_name) not between 2 and 40 then
    v_name := null;
  end if;
  insert into public.profiles (id, display_name, preferred_locale)
  values (new.id, v_name, v_locale)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- RLS et privilèges
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

grant select on public.profiles to authenticated;
-- Seules ces colonnes sont modifiables par l'utilisateur (pas la réputation ni la suspension).
grant update (display_name, preferred_locale) on public.profiles to authenticated;

create policy profiles_select_own_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.user_roles to authenticated;
create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
-- Aucune écriture directe : attribution via la fonction admin_set_role().

grant select on public.app_settings to anon, authenticated;
create policy app_settings_select_public on public.app_settings
  for select to anon, authenticated
  using (is_public or (select private.is_admin()));

grant select on public.audit_logs to authenticated;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using ((select private.is_admin()));

grant execute on function private.has_role(public.app_role) to anon, authenticated;
grant execute on function private.is_staff() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.demo_mode_enabled() to anon, authenticated;
grant execute on function private.admin_mfa_ok() to authenticated;
grant execute on function private.severity_rank(public.severity_level) to anon, authenticated;
grant execute on function private.normalize_place_name(text) to anon, authenticated;
grant execute on function private.immutable_unaccent(text) to anon, authenticated;
revoke execute on function private.log_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function private.setting(text) from public, anon, authenticated;
