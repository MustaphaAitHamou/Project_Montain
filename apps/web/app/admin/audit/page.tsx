import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminAudit({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { t, locale } = await getI18n();
  const { supabase, user } = await getSession();
  if (!supabase || !isAdmin(user)) return <p>{t('admin.forbidden')}</p>;
  const page = Math.max(0, Number((await searchParams).page ?? 0) || 0);
  const { data } = await supabase
    .from('audit_logs')
    .select('id, actor_id, actor_roles, action, target_type, target_id, metadata, created_at')
    .order('id', { ascending: false })
    .range(page * 50, page * 50 + 49);
  return (
    <>
      <h1>{t('admin.audit')}</h1>
      <p className="small muted">
        Journal en ajout seul (aucune modification ni suppression via l’API). Conservation : 12
        mois.
      </p>
      <div className="table-wrap card">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Action</th>
              <th>Cible</th>
              <th>Acteur</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.created_at, locale)}</td>
                <td>{log.action}</td>
                <td>
                  {log.target_type}{' '}
                  {log.target_id ? <code>{log.target_id.slice(0, 8)}</code> : null}
                </td>
                <td>
                  {log.actor_id ? <code>{log.actor_id.slice(0, 8)}</code> : 'système'}{' '}
                  {log.actor_roles.join(', ')}
                </td>
                <td className="small">
                  <code>{JSON.stringify(log.metadata).slice(0, 160)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        {page > 0 && (
          <a className="btn btn-sm btn-outline" href={`/admin/audit?page=${page - 1}`}>
            {t('common.previous')}
          </a>
        )}
        {(data ?? []).length === 50 && (
          <a className="btn btn-sm btn-outline" href={`/admin/audit?page=${page + 1}`}>
            {t('common.next')}
          </a>
        )}
      </div>
    </>
  );
}
