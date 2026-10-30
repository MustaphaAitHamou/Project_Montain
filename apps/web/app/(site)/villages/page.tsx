import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatDateTime, formatDistance } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { listActiveEvents } from '@/lib/data/events';
import { EventMap } from '@/components/map/EventMap';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('villages.title') };
}

export default async function VillagesPage() {
  const { t, tk, locale } = await getI18n();
  const { supabase, user } = await getSession();

  if (!user || !supabase) {
    return (
      <main className="page container stack" id="contenu">
        <h1>{t('villages.title')}</h1>
        <p>{t('villages.intro')}</p>
        <div className="card stack-sm">
          <p>{t('villages.signInToSync')}</p>
          <div className="row">
            <Link href="/connexion?next=/villages" className="btn btn-primary">
              {t('common.signIn')}
            </Link>
            <Link href="/inscription" className="btn btn-outline">
              {t('common.signUp')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [{ data }, active] = await Promise.all([
    supabase.rpc('my_followed_places_summary'),
    listActiveEvents(supabase, 300),
  ]);
  const places = data ?? [];

  return (
    <main className="page container stack" id="contenu">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('villages.title')}</h1>
        <Link href="/villages/ajouter" className="btn btn-primary">
          <Plus size={18} aria-hidden="true" /> {t('villages.add')}
        </Link>
      </div>
      <p className="muted">{t('villages.intro')}</p>

      {places.length === 0 ? (
        <div className="card empty-state">
          <p>{t('villages.empty')}</p>
          <Link href="/villages/ajouter" className="btn btn-primary">
            {t('home.followedEmptyCta')}
          </Link>
        </div>
      ) : (
        <>
          <EventMap
            locale={locale}
            variant="mini"
            initialEvents={active.events}
            initialFetchedAt={active.fetchedAt}
            followedAreas={places.map((p) => ({
              id: p.id,
              label: p.label,
              lat: p.lat,
              lng: p.lng,
              radiusM: p.radius_m,
            }))}
          />
          <ul className="list-plain grid-2">
            {places.map((p) => (
              <li key={p.id} className="card stack-sm">
                <div className="row-between">
                  <h2 style={{ margin: 0 }}>{p.label}</h2>
                  <span className="badge badge-neutral">
                    {tk(`villages.placeType.${p.place_type}`)}
                  </span>
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  {p.commune_name_fr && p.wilaya_name_fr
                    ? t('villages.in', {
                        commune:
                          locale === 'ar' && p.commune_name_ar
                            ? p.commune_name_ar
                            : p.commune_name_fr,
                        wilaya:
                          locale === 'ar' && p.wilaya_name_ar ? p.wilaya_name_ar : p.wilaya_name_fr,
                      })
                    : ''}
                  {' · '}
                  {t('villages.radiusValue', { distance: formatDistance(p.radius_m) })}
                </p>
                <p style={{ margin: 0 }}>
                  <span
                    className={
                      p.active_events > 0 ? 'badge badge-vigilance' : 'badge badge-neutral'
                    }
                  >
                    {p.active_events > 0
                      ? t('villages.activeAlerts', { count: p.active_events })
                      : t('villages.noActiveAlerts')}
                  </span>
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  {t('common.lastUpdate', {
                    time: p.last_event_at
                      ? formatDateTime(p.last_event_at, locale)
                      : t('common.never'),
                  })}
                  {' · '}
                  {p.notify
                    ? t('villages.notify')
                    : t('notifications.title') + ' : ' + t('common.no')}
                </p>
                <Link href={`/villages/${p.id}`} className="btn btn-outline">
                  {t('villages.view')}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
