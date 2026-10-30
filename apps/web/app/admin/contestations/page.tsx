import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { decideAppealAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminAppeals() {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { data } = await supabase
    .from('moderation_appeals')
    .select('id, report_id, message, created_at')
    .eq('status', 'open')
    .order('created_at')
    .limit(50);
  const reportIds = (data ?? []).map((a) => a.report_id);
  const { data: reports } = reportIds.length
    ? await supabase
        .from('report_feed')
        .select('id, subcategory_id, description, rejection_reason')
        .in('id', reportIds)
    : { data: [] };
  const byId = new Map((reports ?? []).map((r) => [r.id, r]));
  return (
    <>
      <h1>{t('admin.appeals')}</h1>
      {(data ?? []).length === 0 ? (
        <div className="card empty-state">
          <p>Aucune contestation ouverte.</p>
        </div>
      ) : (
        <ul className="list-plain stack">
          {(data ?? []).map((a) => {
            const report = byId.get(a.report_id);
            return (
              <li key={a.id} className="card stack-sm">
                <strong>{report ? tk(`subcategory.${report.subcategory_id}`) : a.report_id}</strong>
                {report && (
                  <p className="small" style={{ margin: 0 }}>
                    Signalement : {report.description} — motif du rejet :{' '}
                    {report.rejection_reason
                      ? tk(`rejectionReason.${report.rejection_reason}`)
                      : '—'}
                  </p>
                )}
                <p style={{ margin: 0 }}>« {a.message} »</p>
                <p className="small muted" style={{ margin: 0 }}>
                  {formatDateTime(a.created_at, locale)}
                </p>
                <form action={decideAppealAction} className="row">
                  <input type="hidden" name="appealId" value={a.id} />
                  <input
                    name="note"
                    className="input"
                    style={{ maxWidth: 320 }}
                    placeholder={t('admin.note')}
                  />
                  <button
                    type="submit"
                    name="accept"
                    value="true"
                    className="btn btn-sm btn-primary"
                  >
                    Accepter (réexamen)
                  </button>
                  <button
                    type="submit"
                    name="accept"
                    value="false"
                    className="btn btn-sm btn-outline"
                  >
                    Maintenir le rejet
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
