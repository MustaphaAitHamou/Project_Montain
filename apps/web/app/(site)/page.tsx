import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';
import { CATEGORIES, formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { getPublicSources, listActiveEvents } from '@/lib/data/events';
import { EventMap, type FollowedArea } from '@/components/map/EventMap';
import { EventCard } from '@/components/events/EventCard';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { t, tk, locale } = await getI18n();
  const { supabase, user } = await getSession();

  const { events, fetchedAt, error } = supabase
    ? await listActiveEvents(supabase, 200)
    : { events: [], fetchedAt: new Date().toISOString(), error: null };
  const sources = supabase ? await getPublicSources(supabase) : [];

  let followed: {
    id: string;
    label: string;
    commune_name_fr: string | null;
    wilaya_name_fr: string | null;
    active_events: number;
    lat: number;
    lng: number;
    radius_m: number;
  }[] = [];
  if (supabase && user) {
    const { data } = await supabase.rpc('my_followed_places_summary');
    followed = (data ?? []) as typeof followed;
  }
  const followedAreas: FollowedArea[] = followed.map((f) => ({
    id: f.id,
    label: f.label,
    lat: f.lat,
    lng: f.lng,
    radiusM: f.radius_m,
  }));

  return (
    <main className="page container stack" id="contenu">
      <section className="hero stack-sm" aria-labelledby="situation-title">
        <p className="small" style={{ margin: 0 }}>
          {t('home.zone')} : <strong>{t('home.zoneDefault')}</strong>
        </p>
        <h1 id="situation-title" style={{ margin: 0 }}>
          {events.length > 0 ? t('home.activeCount', { count: events.length }) : t('home.noAlerts')}
        </h1>
        {events.length === 0 && <p style={{ margin: 0 }}>{t('home.noAlertsHint')}</p>}
        <p className="small" style={{ margin: 0 }}>
          {error
            ? t('connectivity.backendUnavailable')
            : t('common.lastUpdate', { time: formatDateTime(fetchedAt, locale) })}
        </p>
        <div className="row">
          <Link href="/signaler" className="btn btn-inverse">
            <Megaphone size={18} aria-hidden="true" />
            {t('home.reportCta')}
          </Link>
          <Link href="/carte" className="btn btn-on-brand">
            {t('home.openMap')}
          </Link>
        </div>
      </section>
      {/* Rubalise rouge et blanche sous le bandeau d'accueil (décorative, une par écran). */}
      <div className="frise" aria-hidden="true" />

      <div className="banner banner-info" role="note">
        <p className="small">
          {t('app.disclaimerShort')} {t('app.disclaimerEmergency')}
        </p>
      </div>

      <section aria-label={t('map.mapLabel')}>
        <EventMap
          locale={locale}
          variant="mini"
          initialEvents={events}
          initialFetchedAt={fetchedAt}
          followedAreas={followedAreas}
        />
      </section>

      <div className="grid-2">
        <section className="card stack-sm" aria-labelledby="followed-title">
          <div className="row-between">
            <h2 id="followed-title">{t('home.followedTitle')}</h2>
            <Link href="/villages" className="small">
              {t('common.seeAll')}
            </Link>
          </div>
          {!user ? (
            <>
              <p className="muted">{t('villages.signInToSync')}</p>
              <Link href="/connexion?next=/villages" className="btn btn-primary">
                {t('common.signIn')}
              </Link>
            </>
          ) : followed.length === 0 ? (
            <>
              <p className="muted">{t('home.followedEmpty')}</p>
              <Link href="/villages/ajouter" className="btn btn-primary">
                <Plus size={18} aria-hidden="true" />
                {t('home.followedEmptyCta')}
              </Link>
            </>
          ) : (
            <ul className="list-plain stack-sm">
              {followed.slice(0, 5).map((f) => (
                <li key={f.id}>
                  <Link href={`/villages/${f.id}`} className="row-between card card-link">
                    <span>
                      <strong>{f.label}</strong>
                      <span className="small muted"> · {f.commune_name_fr ?? ''}</span>
                    </span>
                    <span
                      className={
                        f.active_events > 0 ? 'badge badge-vigilance' : 'badge badge-neutral'
                      }
                    >
                      {f.active_events > 0
                        ? t('villages.activeAlerts', { count: f.active_events })
                        : t('villages.noActiveAlerts')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card stack-sm" aria-labelledby="categories-title">
          <h2 id="categories-title">{t('home.quickCategories')}</h2>
          <div className="row">
            {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
              <Link key={c.id} href={`/alertes?categorie=${c.id}`} className="chip">
                <CategoryIcon categoryId={c.id} size={16} />
                {tk(`category.${c.id}`)}
              </Link>
            ))}
            <Link href="/entraide" className="chip">
              <CategoryIcon categoryId="mutual_aid" size={16} />
              {t('nav.assistance')}
            </Link>
          </div>
        </section>
      </div>

      <section className="stack-sm" aria-labelledby="latest-title">
        <div className="row-between">
          <h2 id="latest-title">{t('home.latestTitle')}</h2>
          <Link href="/alertes" className="small">
            {t('common.seeAll')}
          </Link>
        </div>
        {events.length === 0 ? (
          <div className="card empty-state">
            <p>{t('home.noAlerts')}</p>
            <p className="small">{t('home.noAlertsHint')}</p>
          </div>
        ) : (
          <ul className="list-plain stack-sm">
            {events.slice(0, 5).map((event) => (
              <li key={event.id}>
                <EventCard event={event} locale={locale} t={t} tk={tk} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid-2">
        <section className="card stack-sm" aria-labelledby="vigilance-title">
          <h2 id="vigilance-title">{t('home.vigilanceTitle')}</h2>
          <p className="muted small">{t('home.vigilanceNone')}</p>
        </section>
        <section className="card stack-sm" aria-labelledby="sources-title">
          <h2 id="sources-title">{t('home.sourcesTitle')}</h2>
          <ul className="list-plain stack-sm small">
            {sources.map((s) => (
              <li key={s.id} className="row-between">
                <span>
                  <strong>{s.name}</strong>
                  <br />
                  <span className="muted">{s.attribution}</span>
                </span>
                <span className={s.enabled ? 'badge badge-neutral' : 'badge badge-unverified'}>
                  {s.enabled
                    ? s.last_success_at
                      ? formatDateTime(s.last_success_at, locale)
                      : t('admin.enabled')
                    : t('admin.disabled')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
