import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { moderateAssistanceAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminAssistance() {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { data } = await supabase
    .from('community_assistance')
    .select('id, kind, title, description, commune_code, created_at, expires_at')
    .eq('status', 'pending')
    .order('created_at')
    .limit(50);
  return (
    <>
      <h1>{t('nav.assistance')}</h1>
      <p className="small muted">{t('assistance.safetyNotice')}</p>
      {(data ?? []).length === 0 ? (
        <div className="card empty-state">
          <p>{t('assistance.empty')}</p>
        </div>
      ) : (
        <ul className="list-plain stack">
          {(data ?? []).map((a) => (
            <li key={a.id} className="card stack-sm">
              <strong>
                {tk(`assistance.kind.${a.kind}`)} — {a.title}
              </strong>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.description}</p>
              <p className="small muted" style={{ margin: 0 }}>
                Commune {a.commune_code} · {formatDateTime(a.created_at, locale)} →{' '}
                {formatDateTime(a.expires_at, locale)}
              </p>
              <form action={moderateAssistanceAction} className="row">
                <input type="hidden" name="id" value={a.id} />
                <label className="checkbox-row small">
                  <input type="checkbox" name="verified" /> Lieu d’aide public vérifié
                </label>
                <button
                  type="submit"
                  name="status"
                  value="published"
                  className="btn btn-sm btn-primary"
                >
                  Publier
                </button>
                <button
                  type="submit"
                  name="status"
                  value="rejected"
                  className="btn btn-sm btn-outline"
                >
                  {t('admin.reject')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
