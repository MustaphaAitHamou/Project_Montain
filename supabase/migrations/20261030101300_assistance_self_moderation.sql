-- =====================================================================
-- Entraide : même règle que pour les signalements, pas d'auto-modération.
-- Un modérateur ne peut pas publier ni rejeter sa propre annonce (il peut la clore
-- comme tout auteur via close_my_assistance_post). Migration non destructive.
-- =====================================================================

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
  if exists (select 1 from public.community_assistance where id = p_id and author_id = (select auth.uid())) then
    raise exception 'self_moderation_forbidden' using errcode = '42501';
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
