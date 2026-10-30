import { ADAPTERS } from '@tamurt/server';
import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession, isAdmin } from '@/lib/auth';
import { getServiceClient } from '@/lib/server-services';
import { getServerEnv } from '@/lib/env.server';
import { SourceControls } from '@/components/admin/SourceControls';

export const dynamic = 'force-dynamic';

export default async function AdminSources() {
  const { t, locale } = await getI18n();
  const { supabase, user } = await getSession();
  if (!supabase || !isAdmin(user)) return <p>{t('admin.forbidden')}</p>;
  // Configuration et erreurs : colonnes non exposées par l'API publique → lecture serveur (rôle vérifié ci-dessus).
  const service = getServiceClient();
  const { data: sources } = service
    ? await service.from('alert_sources').select('*').order('id')
    : { data: [] };
  const { data: runs } = await supabase
    .from('api_sync_runs')
    .select(
      'id, source_id, started_at, finished_at, status, items_fetched, items_upserted, events_created, http_status, error, duration_ms, trigger',
    )
    .order('started_at', { ascending: false })
    .limit(30);
  const env = getServerEnv();
  const keyStatus: Record<string, boolean | null> = {
    nasa_firms: Boolean(env.nasaFirmsMapKey),
    open_meteo: env.openMeteoApiKey ? true : null,
  };
  return (
    <>
      <h1>{t('admin.sources')}</h1>
      <p className="small muted">
        Chaque source est désactivée par défaut : vérifier ses conditions d’utilisation (usage
        commercial éventuel) avant de l’activer. Les clés restent côté serveur. En cas d’échecs
        répétés, un disjoncteur suspend temporairement les appels.
      </p>
      <ul className="list-plain stack">
        {(sources ?? []).map((s) => {
          const adapter = ADAPTERS[s.id];
          return (
            <li key={s.id} className="card stack-sm">
              <div className="row-between">
                <strong>{s.name}</strong>
                <span className={s.enabled ? 'badge badge-neutral' : 'badge badge-unverified'}>
                  {s.enabled ? t('admin.enabled') : t('admin.disabled')}
                </span>
              </div>
              <p className="small" style={{ margin: 0 }}>
                Licence : {s.license}
                <br />
                Attribution : {s.attribution}
                {adapter ? (
                  <>
                    <br />
                    Limites : {adapter.rateLimit}
                  </>
                ) : null}
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                {t('admin.lastSync')} :{' '}
                {s.last_sync_at ? formatDateTime(s.last_sync_at, locale) : t('common.never')} ·{' '}
                {t('admin.lastSuccess')} :{' '}
                {s.last_success_at ? formatDateTime(s.last_success_at, locale) : t('common.never')}{' '}
                · échecs consécutifs : {s.consecutive_failures}
                {s.circuit_open_until
                  ? ` · disjoncteur ouvert jusqu’à ${formatDateTime(s.circuit_open_until, locale)}`
                  : ''}
              </p>
              {s.requires_key && keyStatus[s.id] === false && (
                <p className="banner banner-warning small">
                  {t('admin.missingKey')} (NASA_FIRMS_MAP_KEY)
                </p>
              )}
              {s.id === 'open_meteo' && keyStatus.open_meteo === null && (
                <p className="banner banner-warning small">
                  Sans OPEN_METEO_API_KEY : API gratuite, usage non commercial uniquement.
                </p>
              )}
              {s.last_error && <p className="error small">Dernière erreur : {s.last_error}</p>}
              {adapter && <SourceControls sourceId={s.id} enabled={s.enabled} />}
            </li>
          );
        })}
      </ul>
      <section className="card stack-sm">
        <h2>Historique des synchronisations</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Début</th>
                <th>Statut</th>
                <th>Reçus</th>
                <th>Enregistrés</th>
                <th>Événements</th>
                <th>HTTP</th>
                <th>Durée</th>
                <th>Erreur</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.source_id}</td>
                  <td>{formatDateTime(r.started_at, locale)}</td>
                  <td>{r.status}</td>
                  <td>{r.items_fetched}</td>
                  <td>{r.items_upserted}</td>
                  <td>{r.events_created}</td>
                  <td>{r.http_status ?? '—'}</td>
                  <td>{r.duration_ms ? `${r.duration_ms} ms` : '—'}</td>
                  <td className="small">{r.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
