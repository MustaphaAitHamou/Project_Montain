import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACTIVE_STATUSES, formatDistance, type Severity } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { requireUser } from '@/lib/auth';
import { toEventView, type EventView } from '@/lib/events';
import { EventMap } from '@/components/map/EventMap';
import { EventCard } from '@/components/events/EventCard';
import { EditPlaceForm } from '@/components/villages/EditPlaceForm';
import { deleteFollowedPlaceAction } from '@/app/actions/villages';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('villages.title') };
}

export default async function VillagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, tk, locale } = await getI18n();
  const { supabase } = await requireUser(`/villages/${id}`);
  if (!supabase) notFound();
  const { data: places } = await supabase.rpc('my_followed_places_summary');
  const place = (places ?? []).find((p) => p.id === id);
  if (!place) notFound();

  const categories = place.categories.length > 0 ? place.categories : undefined;
  const [{ data: nearAll }, { data: inCommune }] = await Promise.all([
    supabase.rpc('events_near', {
      p_lat: place.lat,
      p_lng: place.lng,
      p_radius_m: place.radius_m,
      p_categories: categories,
      p_active_only: false,
      p_limit: 100,
    }),
    place.place_type === 'commune' && place.commune_code
      ? supabase
          .from('event_feed')
          .select('*')
          .eq('is_public', true)
          .eq('commune_code', place.commune_code)
          .order('last_activity_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const byId = new Map<string, EventView>();
  for (const row of [...(nearAll ?? []), ...(inCommune ?? [])]) {
    const view = toEventView(row);
    if (view && (!categories || categories.includes(view.categoryId))) byId.set(view.id, view);
  }
  const events = [...byId.values()].sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
  const active = events.filter((e) => ACTIVE_STATUSES.includes(e.status));
  const history = events.filter((e) => !ACTIVE_STATUSES.includes(e.status));

  return (
    <main className="page container stack" id="contenu">
      <nav className="small">
        <Link href="/villages">← {t('villages.title')}</Link>
      </nav>
      <h1>{place.label}</h1>
      <p className="muted">
        {place.commune_name_fr && place.wilaya_name_fr
          ? t('villages.in', { commune: place.commune_name_fr, wilaya: place.wilaya_name_fr })
          : ''}{' '}
        · {t('villages.radiusValue', { distance: formatDistance(place.radius_m) })}
      </p>
      <EventMap
        locale={locale}
        variant="mini"
        initialEvents={active}
        initialFetchedAt={new Date().toISOString()}
        followedAreas={[
          {
            id: place.id,
            label: place.label,
            lat: place.lat,
            lng: place.lng,
            radiusM: place.radius_m,
          },
        ]}
        initialCenter={{ lat: place.lat, lng: place.lng, zoom: place.radius_m > 10000 ? 9.5 : 11 }}
      />
      <section className="stack-sm" aria-labelledby="active-title">
        <h2 id="active-title">{t('alerts.active')}</h2>
        {active.length === 0 ? (
          <div className="card empty-state">
            <p>{t('home.noAlerts')}</p>
            <p className="small">{t('home.noAlertsHint')}</p>
          </div>
        ) : (
          <ul className="list-plain stack-sm">
            {active.map((e) => (
              <li key={e.id}>
                <EventCard event={e} locale={locale} t={t} tk={tk} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="stack-sm" aria-labelledby="history-title">
        <h2 id="history-title">{t('villages.history')}</h2>
        {history.length === 0 ? (
          <p className="muted">{t('alerts.empty')}</p>
        ) : (
          <ul className="list-plain stack-sm">
            {history.slice(0, 30).map((e) => (
              <li key={e.id}>
                <EventCard event={e} locale={locale} t={t} tk={tk} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card stack" aria-labelledby="settings-title">
        <h2 id="settings-title">{t('nav.settings')}</h2>
        <EditPlaceForm
          locale={locale}
          place={{
            id: place.id,
            label: place.label,
            radius_m: place.radius_m,
            categories: place.categories,
            notify: place.notify,
            min_severity: (place.min_severity ?? null) as Severity | null,
          }}
        />
        <form action={deleteFollowedPlaceAction}>
          <input type="hidden" name="id" value={place.id} />
          <button
            type="submit"
            className="btn btn-outline"
            style={{ color: 'var(--color-danger)' }}
          >
            {t('villages.remove')}
          </button>
        </form>
      </section>
    </main>
  );
}
