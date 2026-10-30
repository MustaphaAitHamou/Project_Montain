import Link from 'next/link';
import {
  SEVERITIES,
  VERIFICATION_STATUSES,
  formatDateTime,
  maxSeverityForStatus,
} from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { placeLabel, toEventView } from '@/lib/events';
import { ActionForm } from '@/components/admin/ActionForm';
import { setEventVisibilityAction, updateEventAction } from '@/app/actions/admin';
import { SeverityBadge, StatusBadge } from '@/components/ui/Badges';

export const dynamic = 'force-dynamic';

export default async function AdminEvents({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { statut } = await searchParams;
  let query = supabase
    .from('event_feed')
    .select('*')
    .order('last_activity_at', { ascending: false })
    .limit(50);
  if (statut && (VERIFICATION_STATUSES as readonly string[]).includes(statut)) {
    query = query.eq('status', statut as (typeof VERIFICATION_STATUSES)[number]);
  }
  const { data } = await query;
  const events = (data ?? [])
    .map((row) => ({ row, view: toEventView(row) }))
    .filter((e) => e.view !== null);
  return (
    <>
      <h1>{t('admin.events')}</h1>
      <nav className="row">
        <Link href="/admin/evenements" className="chip">
          {t('common.all')}
        </Link>
        {VERIFICATION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/evenements?statut=${s}`}
            className={statut === s ? 'chip active' : 'chip'}
          >
            {tk(`status.${s}`)}
          </Link>
        ))}
      </nav>
      <ul className="list-plain stack">
        {events.map(({ row, view }) => {
          if (!view) return null;
          return (
            <li key={view.id} className="card stack-sm">
              <div className="row-between">
                <Link href={`/alertes/${view.id}`}>
                  <strong>{tk(`subcategory.${view.subcategoryId}`)}</strong> —{' '}
                  {placeLabel(view, locale)}
                </Link>
                <span className="row">
                  {view.isDemo && <span className="badge badge-demo">{t('demo.badge')}</span>}
                  <SeverityBadge severity={view.severity} t={t} />
                  <StatusBadge status={view.status} t={t} />
                  <span className="badge badge-neutral">
                    {row.is_public ? 'public' : 'non public'}
                  </span>
                </span>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                {tk(`sourceKind.${view.sourceKind}`)} · {t('event.updated')}{' '}
                {formatDateTime(view.lastActivityAt, locale)} ·{' '}
                {t('event.reports', { count: view.reportCount })} · <code>{view.id}</code>
              </p>
              <details>
                <summary className="small">
                  {t('admin.changeStatus')} / {t('admin.changeSeverity')}
                </summary>
                <ActionForm
                  action={updateEventAction}
                  submitLabel={t('common.save')}
                  className="stack-sm"
                >
                  <input type="hidden" name="eventId" value={view.id} />
                  <div className="inline-form">
                    <div className="field">
                      <label htmlFor={`st-${view.id}`}>{t('admin.changeStatus')}</label>
                      <select id={`st-${view.id}`} name="status" className="select" defaultValue="">
                        <option value="">—</option>
                        {VERIFICATION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {tk(`status.${s}`)} (max {tk(`severity.${maxSeverityForStatus(s)}`)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`sv-${view.id}`}>{t('admin.changeSeverity')}</label>
                      <select
                        id={`sv-${view.id}`}
                        name="severity"
                        className="select"
                        defaultValue=""
                      >
                        <option value="">—</option>
                        {SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {tk(`severity.${s}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor={`pn-${view.id}`}>{t('admin.publicNote')}</label>
                    <textarea
                      id={`pn-${view.id}`}
                      name="publicNote"
                      className="textarea"
                      maxLength={500}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`rs-${view.id}`}>{t('admin.justification')}</label>
                    <input
                      id={`rs-${view.id}`}
                      name="reason"
                      className="input"
                      required
                      minLength={3}
                      maxLength={500}
                    />
                  </div>
                </ActionForm>
                <form
                  action={setEventVisibilityAction}
                  className="row"
                  style={{ marginBlockStart: 8 }}
                >
                  <input type="hidden" name="eventId" value={view.id} />
                  <input type="hidden" name="isPublic" value={row.is_public ? 'false' : 'true'} />
                  <input
                    name="reason"
                    className="input"
                    style={{ maxWidth: 280 }}
                    placeholder={t('admin.justification')}
                    required
                    minLength={3}
                  />
                  <button type="submit" className="btn btn-sm btn-outline">
                    {row.is_public ? 'Retirer de la publication' : 'Publier'}
                  </button>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
