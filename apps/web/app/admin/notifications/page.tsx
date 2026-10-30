import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession, isAdmin } from '@/lib/auth';
import { isoHoursAgo } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminNotifications() {
  const { t, locale } = await getI18n();
  const { supabase, user } = await getSession();
  if (!supabase || !isAdmin(user)) return <p>{t('admin.forbidden')}</p>;
  const [{ data: outbox }, { data: deliveries }] = await Promise.all([
    supabase
      .from('notification_outbox')
      .select(
        'id, event_id, reason, event_version, status, attempts, recipients_count, push_count, last_error, created_at, processed_at',
      )
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('notification_deliveries')
      .select('status, channel')
      .gte('created_at', isoHoursAgo(24 * 7))
      .limit(5000),
  ]);
  const stats = new Map<string, number>();
  for (const d of deliveries ?? [])
    stats.set(`${d.channel}/${d.status}`, (stats.get(`${d.channel}/${d.status}`) ?? 0) + 1);
  return (
    <>
      <h1>{t('admin.notifications')}</h1>
      <section className="card stack-sm">
        <h2>Remises (7 jours)</h2>
        {stats.size === 0 ? (
          <p className="muted">Aucune remise enregistrée.</p>
        ) : (
          <ul className="list-plain row">
            {[...stats.entries()].map(([key, n]) => (
              <li key={key} className="badge badge-neutral">
                {key} : {n}
              </li>
            ))}
          </ul>
        )}
        <p className="small muted">
          « sent » = accepté par le service de push ; « delivered » = accusé positif du fournisseur
          ; la réception sur l’appareil n’est jamais garantie.
        </p>
      </section>
      <section className="card stack-sm">
        <h2>Outbox</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Créée</th>
                <th>Événement</th>
                <th>Raison</th>
                <th>Statut</th>
                <th>Destinataires</th>
                <th>Push</th>
                <th>Erreur</th>
              </tr>
            </thead>
            <tbody>
              {(outbox ?? []).map((o) => (
                <tr key={o.id}>
                  <td>{formatDateTime(o.created_at, locale)}</td>
                  <td>
                    <a href={`/alertes/${o.event_id}`}>{o.event_id.slice(0, 8)}</a> v
                    {o.event_version}
                  </td>
                  <td>{o.reason}</td>
                  <td>
                    {o.status} ({o.attempts})
                  </td>
                  <td>{o.recipients_count ?? '—'}</td>
                  <td>{o.push_count ?? '—'}</td>
                  <td className="small">{o.last_error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
