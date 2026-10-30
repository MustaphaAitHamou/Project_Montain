-- =====================================================================
-- Correctif : la limite de 10 appareils par compte ne doit pas empêcher un appareil
-- DÉJÀ enregistré de renouveler son jeton (réenregistrement au démarrage de l'application).
-- Migration non destructive : remplacement de la fonction, signature et droits inchangés.
-- =====================================================================

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
  if (
    select count(*) from public.device_push_tokens
    where user_id = v_uid and enabled and token <> p_token
  ) >= 10 then
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
