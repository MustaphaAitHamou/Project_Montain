import Link from 'next/link';
import {
  CATEGORIES,
  REJECTION_REASONS,
  SEVERITIES,
  capSeverity,
  findSubcategory,
  formatDateTime,
  formatDistance,
  getCategory,
  isCategoryId,
} from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { toEventView } from '@/lib/events';
import { ActionForm } from '@/components/admin/ActionForm';
import { approveReportAction, rejectReportAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export default async function ModerationQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const params = await searchParams;
  const category = param(params.categorie);
  // Recherche littérale : les jokers SQL et PostgREST sont retirés de la saisie.
  const q = param(params.q)
    .replace(/[%_*\\]/g, '')
    .slice(0, 100);
  const page = Math.max(1, Number.parseInt(param(params.page), 10) || 1);
  let query = supabase
    .from('report_feed')
    .select(
      'id, author_id, category_id, subcategory_id, description, lat, lng, location_precision, location_uncertainty_m, commune_code, observed_at, created_at, event_id',
      { count: 'exact' },
    )
    .eq('moderation_status', 'pending');
  if (isCategoryId(category)) query = query.eq('category_id', category);
  if (q) query = query.ilike('description', `%${q}%`);
  // File d'attente : les plus anciens d'abord.
  const { data: reports, count } = await query
    .order('created_at', { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (isCategoryId(category)) sp.set('categorie', category);
    if (q) sp.set('q', q);
    if (n > 1) sp.set('page', String(n));
    const qs = sp.toString();
    return qs ? `/admin/moderation?${qs}` : '/admin/moderation';
  };
  const items = (reports ?? []).filter(
    (
      r,
    ): r is typeof r & {
      id: string;
      category_id: string;
      subcategory_id: string;
      created_at: string;
    } => Boolean(r.id && r.category_id && r.subcategory_id && r.created_at),
  );

  const communeCodes = [
    ...new Set(items.map((r) => r.commune_code).filter((c): c is string => Boolean(c))),
  ];
  const authorIds = [
    ...new Set(items.map((r) => r.author_id).filter((a): a is string => Boolean(a))),
  ];
  const [{ data: communes }, { data: authors }, { data: media }] = await Promise.all([
    communeCodes.length
      ? supabase.from('communes').select('code, name_fr, wilaya_code').in('code', communeCodes)
      : Promise.resolve({ data: [] }),
    authorIds.length
      ? supabase.from('profiles').select('id, reputation, created_at').in('id', authorIds)
      : Promise.resolve({ data: [] }),
    items.length
      ? supabase
          .from('alert_media')
          .select('id, report_id, status')
          .in(
            'report_id',
            items.map((r) => r.id),
          )
      : Promise.resolve({ data: [] }),
  ]);
  const communeByCode = new Map((communes ?? []).map((c) => [c.code, c]));
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));

  return (
    <>
      <h1>{t('admin.moderation')}</h1>
      <p className="muted">{t('admin.pendingTotal', { count: total })}</p>
      <form method="get" className="row" role="search" aria-label={t('common.filters')}>
        <label className="field">
          <span>{t('alerts.filterCategory')}</span>
          <select
            name="categorie"
            className="select"
            defaultValue={isCategoryId(category) ? category : ''}
          >
            <option value="">{t('common.all')}</option>
            {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
              <option key={c.id} value={c.id}>
                {tk(`category.${c.id}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('admin.searchReports')}</span>
          <input type="search" name="q" className="input" defaultValue={q} maxLength={100} />
        </label>
        <button type="submit" className="btn btn-sm btn-outline">
          {t('common.apply')}
        </button>
      </form>
      {items.length === 0 ? (
        <div className="card empty-state">
          <p>{t('admin.noPending')}</p>
        </div>
      ) : (
        <ul className="list-plain stack">
          {items.map((r) => {
            const commune = r.commune_code ? communeByCode.get(r.commune_code) : undefined;
            const author = r.author_id ? authorById.get(r.author_id) : undefined;
            const sub = findSubcategory(r.subcategory_id);
            const category = isCategoryId(r.category_id) ? getCategory(r.category_id) : null;
            const mediaCount = (media ?? []).filter((m) => m.report_id === r.id).length;
            return (
              <li key={r.id} className="card stack-sm">
                <div className="row-between">
                  <strong>
                    {tk(`category.${r.category_id}`)} — {tk(`subcategory.${r.subcategory_id}`)}
                  </strong>
                  <span className="small muted">{formatDateTime(r.created_at, locale)}</span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.description}</p>
                <p className="small muted" style={{ margin: 0 }}>
                  {commune ? `${commune.name_fr} (${commune.code})` : t('common.unknown')} ·{' '}
                  {r.location_precision} ± {formatDistance(r.location_uncertainty_m)} ·{' '}
                  {t('event.observed')} : {formatDateTime(r.observed_at, locale)}
                  {author ? ` · réputation auteur : ${author.reputation}` : ''}
                  {mediaCount > 0 ? ` · ${mediaCount} photo(s) en quarantaine` : ''}
                  {r.event_id ? ' · publié automatiquement (Reçu, non vérifié)' : ''}
                </p>
                {r.lat !== null && r.lng !== null && (
                  <NearbyEvents
                    lat={r.lat}
                    lng={r.lng}
                    categoryId={r.category_id}
                    radius={category?.notification.dedupRadiusMeters ?? 1000}
                  />
                )}
                <div className="grid-2">
                  <ActionForm
                    action={approveReportAction}
                    submitLabel={t('admin.approve')}
                    className="stack-sm card"
                  >
                    <input type="hidden" name="reportId" value={r.id} />
                    <div className="field">
                      <label htmlFor={`mode-${r.id}`}>Mode</label>
                      <select
                        id={`mode-${r.id}`}
                        name="mode"
                        className="select"
                        defaultValue="new_event"
                      >
                        <option value="new_event">{t('admin.approveNew')}</option>
                        <option value="attach">{t('admin.attach')}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`event-${r.id}`}>ID de l’événement (rattachement)</label>
                      <input
                        id={`event-${r.id}`}
                        name="eventId"
                        className="input"
                        placeholder="uuid"
                      />
                    </div>
                    <div className="inline-form">
                      <div className="field">
                        <label htmlFor={`status-${r.id}`}>{t('admin.changeStatus')}</label>
                        <select
                          id={`status-${r.id}`}
                          name="status"
                          className="select"
                          defaultValue="under_review"
                        >
                          {(['under_review', 'corroborated', 'confirmed'] as const).map((s) => (
                            <option key={s} value={s}>
                              {tk(`status.${s}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`severity-${r.id}`}>{t('admin.changeSeverity')}</label>
                        <select
                          id={`severity-${r.id}`}
                          name="severity"
                          className="select"
                          defaultValue={capSeverity(
                            sub?.defaultSeverity ?? 'information',
                            'under_review',
                          )}
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>
                              {tk(`severity.${s}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="hint">
                      Plafonds : en vérification → Vigilance ; recoupé → Important ; confirmé →
                      Critique.
                    </p>
                    <div className="field">
                      <label htmlFor={`note-${r.id}`}>{t('admin.publicNote')}</label>
                      <textarea
                        id={`note-${r.id}`}
                        name="publicNote"
                        className="textarea"
                        maxLength={500}
                      />
                    </div>
                  </ActionForm>
                  <ActionForm
                    action={rejectReportAction}
                    submitLabel={t('admin.reject')}
                    className="stack-sm card"
                    danger
                  >
                    <input type="hidden" name="reportId" value={r.id} />
                    <div className="field">
                      <label htmlFor={`reason-${r.id}`}>{t('admin.reason')}</label>
                      <select id={`reason-${r.id}`} name="reason" className="select" required>
                        {REJECTION_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {tk(`rejectionReason.${reason}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`rnote-${r.id}`}>{t('admin.note')}</label>
                      <textarea
                        id={`rnote-${r.id}`}
                        name="note"
                        className="textarea"
                        maxLength={500}
                      />
                    </div>
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <nav className="row-between" aria-label={t('admin.pageOf', { page, total: pages })}>
          {page > 1 ? <Link href={pageHref(page - 1)}>← {t('common.previous')}</Link> : <span />}
          <span className="small muted">{t('admin.pageOf', { page, total: pages })}</span>
          {page < pages ? <Link href={pageHref(page + 1)}>{t('common.next')} →</Link> : <span />}
        </nav>
      )}
      <p className="small muted">
        <Link href="/admin/medias">{t('admin.media')}</Link> · Les photos sont publiées séparément
        après examen.
      </p>
    </>
  );
}

async function NearbyEvents({
  lat,
  lng,
  categoryId,
  radius,
}: {
  lat: number;
  lng: number;
  categoryId: string;
  radius: number;
}) {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { data } = await supabase.rpc('events_near', {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: Math.max(radius, 1000),
    p_categories: [categoryId],
    p_active_only: true,
    p_limit: 5,
  });
  const events = (data ?? []).map(toEventView).filter((e) => e !== null);
  return (
    <div className="banner banner-info">
      <div className="stack-sm">
        <strong className="small">
          {t('admin.nearbyEvents')} : {events.length}
        </strong>
        <a
          className="small"
          href={`/carte?lat=${lat}&lng=${lng}&z=13`}
          target="_blank"
          rel="noreferrer"
        >
          {t('event.viewOnMap')} ({lat.toFixed(4)}, {lng.toFixed(4)})
        </a>
        {events.length > 0 && (
          <ul className="list-plain small">
            {events.map((e) => (
              <li key={e.id}>
                <code>{e.id}</code> · {tk(`subcategory.${e.subcategoryId}`)} ·{' '}
                {tk(`status.${e.status}`)} · {formatDateTime(e.lastActivityAt, locale)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
