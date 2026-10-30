-- =====================================================================
-- Politique de conservation des données (voir docs/security/data-retention.md).
-- Exécutée chaque nuit par pg_cron lorsque l'extension est disponible ;
-- peut aussi être lancée manuellement : select private.apply_retention();
-- Les fichiers de Storage (médias rejetés) sont purgés par le serveur via l'API Storage.
-- =====================================================================

create or replace function private.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- Événements terminés depuis plus de 30 jours : archivés (retirés de la carte en direct).
  perform set_config('app.change_reason', 'Archivage automatique (30 jours après la fin)', true);
  update public.alert_events set status = 'archived'
  where status = 'resolved' and coalesce(ended_at, updated_at) < now() - interval '30 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('events_archived', v_n);

  -- Signalements rejetés ou retirés depuis plus de 180 jours : contenu anonymisé.
  update public.alert_reports r
  set description = '[contenu supprimé — durée de conservation dépassée]',
      author_id = null,
      location = coalesce((select c.centroid from public.communes c where c.code = r.commune_code), r.location)
  where moderation_status in ('rejected', 'withdrawn')
    and coalesce(moderated_at, withdrawn_at, created_at) < now() - interval '180 days'
    and author_id is not null;
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('reports_anonymized', v_n);

  delete from public.external_observations
  where event_id is null and (
    (kind = 'thermal_hotspot' and observed_at < now() - interval '30 days')
    or (kind in ('weather_forecast', 'weather_warning') and observed_at < now() - interval '7 days')
    or (kind = 'earthquake' and observed_at < now() - interval '365 days')
  );
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('observations_deleted', v_n);

  delete from public.api_sync_runs where started_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('sync_runs_deleted', v_n);

  delete from public.notification_outbox where status = 'done' and created_at < now() - interval '30 days';
  delete from public.notification_deliveries where created_at < now() - interval '90 days';
  delete from public.user_notifications where created_at < now() - interval '180 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('notifications_deleted', v_n);

  delete from public.device_push_tokens
  where (not enabled and disabled_at < now() - interval '30 days')
     or last_seen_at < now() - interval '270 days';

  update public.community_assistance set status = 'closed'
  where status = 'published' and expires_at < now();
  delete from public.community_assistance
  where status in ('closed', 'rejected') and updated_at < now() - interval '180 days';

  delete from public.abuse_reports where status <> 'open' and handled_at < now() - interval '365 days';
  delete from public.audit_logs where created_at < now() - interval '365 days';
  get diagnostics v_n = row_count; v_result := v_result || jsonb_build_object('audit_logs_deleted', v_n);

  return v_result;
end;
$$;

-- Planification quotidienne (03:17 UTC) si pg_cron est disponible.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('tamurt-retention', '17 3 * * *', 'select private.apply_retention()');
  else
    raise notice 'pg_cron indisponible : planifier private.apply_retention() autrement.';
  end if;
end;
$$;
