import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { handleAbuseAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminAbuse() {
  const { t, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { data } = await supabase
    .from('abuse_reports')
    .select('id, target_type, target_id, reason, details, created_at')
    .eq('status', 'open')
    .order('created_at')
    .limit(50);
  return (
    <>
      <h1>{t('admin.abuse')}</h1>
      {(data ?? []).length === 0 ? (
        <div className="card empty-state">
          <p>Aucun signalement de contenu ouvert.</p>
        </div>
      ) : (
        <ul className="list-plain stack">
          {(data ?? []).map((a) => (
            <li key={a.id} className="card stack-sm">
              <strong>
                {a.target_type} · {a.reason}
              </strong>
              <p className="small" style={{ margin: 0 }}>
                {a.target_type === 'event' ? (
                  <a href={`/alertes/${a.target_id}`}>{a.target_id}</a>
                ) : (
                  <code>{a.target_id}</code>
                )}
              </p>
              {a.details && <p style={{ margin: 0 }}>{a.details}</p>}
              <p className="small muted" style={{ margin: 0 }}>
                {formatDateTime(a.created_at, locale)}
              </p>
              <form action={handleAbuseAction} className="row">
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  name="status"
                  value="actioned"
                  className="btn btn-sm btn-primary"
                >
                  Traité (mesure prise)
                </button>
                <button
                  type="submit"
                  name="status"
                  value="dismissed"
                  className="btn btn-sm btn-outline"
                >
                  Sans suite
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
