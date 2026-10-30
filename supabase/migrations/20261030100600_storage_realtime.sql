-- =====================================================================
-- Stockage des médias et diffusion temps réel.
--
-- report-media-quarantine (privé) : dépôt par l'auteur dans {uid}/{report_id}/…
--   lisible par l'auteur et l'équipe de modération uniquement.
-- report-media-public (public) : copie ré-encodée SANS métadonnées EXIF, écrite
--   uniquement par le serveur (rôle service) après validation d'un modérateur.
-- La vidéo n'est pas acceptée dans le MVP.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-media-quarantine', 'report-media-quarantine', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('report-media-public', 'report-media-public', true, 5242880,
   array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy tamurt_quarantine_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-media-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.alert_reports r
      where r.id::text = (storage.foldername(name))[2]
        and r.author_id = (select auth.uid())
        and r.moderation_status = 'pending'
    )
  );

create policy tamurt_quarantine_select_own_or_staff on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-media-quarantine'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_staff()))
  );

create policy tamurt_quarantine_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'report-media-quarantine'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy tamurt_public_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'report-media-public');

-- ---------------------------------------------------------------------
-- Realtime : uniquement les événements (filtrés par la RLS) et la boîte
-- de réception de l'utilisateur (RLS : ses propres lignes).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.alert_events, public.user_notifications;
  end if;
end;
$$;
