-- =====================================================================
-- Espace Entraide (module secondaire, modéré, sans messagerie privée).
-- Aucune donnée personnelle publique : localisation à l'échelle de la commune.
-- =====================================================================

create table public.community_assistance (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('need', 'offer', 'volunteers', 'distribution')),
  title text not null check (char_length(title) between 5 and 80),
  description text not null check (char_length(description) between 20 and 1000),
  commune_code text not null references public.communes (code),
  status text not null default 'pending' check (status in ('pending', 'published', 'closed', 'rejected')),
  -- Les lieux d'aide publics (ex. point de distribution d'une association reconnue)
  -- ne sont signalés comme vérifiés qu'après contrôle par un modérateur.
  is_verified_public_aid_point boolean not null default false,
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  is_demo boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index community_assistance_published on public.community_assistance (commune_code, created_at desc)
  where status = 'published';
create index community_assistance_pending on public.community_assistance (created_at) where status = 'pending';
create trigger community_assistance_updated_at before update on public.community_assistance
  for each row execute function private.set_updated_at();

alter table public.community_assistance enable row level security;

grant select on public.community_assistance to anon, authenticated;
create policy community_assistance_read on public.community_assistance for select to anon, authenticated
  using (
    (status = 'published' and expires_at > now() and (not is_demo or (select private.demo_mode_enabled())))
    or author_id = (select auth.uid())
    or (select private.is_staff())
  );
-- Écritures via create_assistance_post() / moderate_assistance_post() uniquement.
