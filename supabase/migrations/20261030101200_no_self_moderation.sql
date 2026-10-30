-- =====================================================================
-- Pas d'auto-modération ni d'auto-confirmation.
-- Un membre de l'équipe (ou un partenaire / contributeur fiable) ne peut :
--   - ni valider ni rejeter son propre signalement ;
--   - ni relever le statut (recoupé, confirmé) d'un événement auquel il a contribué ;
--   - ni ajouter une vérification « appuie » sur un tel événement.
-- Migration non destructive : nouvelles versions des fonctions, signatures et droits inchangés.
-- =====================================================================

create or replace function private.has_contributed(p_event_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.alert_reports r
    where r.event_id = p_event_id and r.author_id = p_uid
  );
$$;
revoke execute on function private.has_contributed(uuid, uuid) from public, anon, authenticated;

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
  -- Pas d'auto-modération : l'auteur d'un signalement ne peut ni le valider ni le rejeter.
  if v_report.author_id = v_uid then
    raise exception 'self_moderation_forbidden' using errcode = '42501';
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
    -- Pas d'auto-confirmation : un contributeur de l'événement ne peut pas en relever le statut.
    if private.status_strength(p_status) > private.status_strength(v_event.status)
       and private.has_contributed(v_event.id, v_uid) then
      raise exception 'self_moderation_forbidden' using errcode = '42501';
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
  -- Pas d'auto-modération : l'auteur d'un signalement ne peut ni le valider ni le rejeter.
  if v_report.author_id = v_uid then
    raise exception 'self_moderation_forbidden' using errcode = '42501';
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
  -- Pas d'auto-confirmation : un contributeur de l'événement ne peut pas en relever le statut.
  if p_status in ('corroborated', 'confirmed')
     and private.status_strength(p_status) > private.status_strength(v_event.status)
     and private.has_contributed(p_event_id, v_uid) then
    raise exception 'self_moderation_forbidden' using errcode = '42501';
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
  -- Pas d'auto-corroboration : on ne peut pas appuyer un événement auquel on a contribué.
  if p_verdict = 'supports' and private.has_contributed(p_event_id, v_uid) then
    raise exception 'self_moderation_forbidden' using errcode = '42501';
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
