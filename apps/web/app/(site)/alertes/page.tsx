import type { Metadata } from 'next';
import Link from 'next/link';
import { ACTIVE_STATUSES, CATEGORIES, isCategoryId, type VerificationStatus } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { listPublicEvents } from '@/lib/data/events';
import { EventCard } from '@/components/events/EventCard';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('alerts.title') };
}

const HISTORY_STATUSES: VerificationStatus[] = ['resolved', 'archived'];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; vue?: string }>;
}) {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await getSession();
  const params = await searchParams;
  const category = isCategoryId(params.categorie) ? params.categorie : null;
  const history = params.vue === 'historique';

  const { events, error } = supabase
    ? await listPublicEvents(supabase, {
        categories: category ? [category] : undefined,
        statuses: history ? HISTORY_STATUSES : ACTIVE_STATUSES,
        sinceHours: history ? 24 * 90 : undefined,
        limit: 100,
      })
    : { events: [], error: null };

  const link = (next: { categorie?: string | null; vue?: string | null }) => {
    const search = new URLSearchParams();
    const c = next.categorie === undefined ? category : next.categorie;
    const v = next.vue === undefined ? (history ? 'historique' : null) : next.vue;
    if (c) search.set('categorie', c);
    if (v) search.set('vue', v);
    const qs = search.toString();
    return qs ? `/alertes?${qs}` : '/alertes';
  };

  return (
    <main className="page container stack" id="contenu">
      <h1>{t('alerts.title')}</h1>
      <nav className="row" aria-label={t('alerts.title')}>
        <Link
          href={link({ vue: null })}
          className={history ? 'chip' : 'chip active'}
          aria-current={!history ? 'page' : undefined}
        >
          {t('alerts.active')}
        </Link>
        <Link
          href={link({ vue: 'historique' })}
          className={history ? 'chip active' : 'chip'}
          aria-current={history ? 'page' : undefined}
        >
          {t('alerts.history')}
        </Link>
      </nav>
      <div className="row" role="group" aria-label={t('alerts.filterCategory')}>
        <Link href={link({ categorie: null })} className={category ? 'chip' : 'chip active'}>
          {t('common.all')}
        </Link>
        {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
          <Link
            key={c.id}
            href={link({ categorie: c.id })}
            className={category === c.id ? 'chip active' : 'chip'}
          >
            <CategoryIcon categoryId={c.id} size={16} />
            {tk(`category.${c.id}`)}
          </Link>
        ))}
      </div>
      {error && (
        <div className="banner banner-danger" role="alert">
          <p>{t('connectivity.backendUnavailable')}</p>
        </div>
      )}
      {events.length === 0 ? (
        <div className="card empty-state">
          <p>{t('alerts.empty')}</p>
          {!history && <p className="small">{t('home.noAlertsHint')}</p>}
        </div>
      ) : (
        <ul className="list-plain stack-sm">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} locale={locale} t={t} tk={tk} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
