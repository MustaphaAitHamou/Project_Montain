import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, MapPin } from 'lucide-react';
import { displayClassFor, formatDateTime, formatDistance, formatUtc } from '@tamurt/shared';
import type { TranslationKey } from '@tamurt/shared/i18n';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { getPublicEnv } from '@/lib/env';
import {
  getEventMedia,
  getEventTimeline,
  getEventVerifications,
  getPublicEvent,
} from '@/lib/data/events';
import { eventTitle, placeLabel } from '@/lib/events';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { DemoBadge, SeverityBadge, SourceBadge, StatusBadge } from '@/components/ui/Badges';
import { SingleEventMap } from '@/components/map/SingleEventMap';
import { ShareButton } from '@/components/events/ShareButton';
import { AbuseReportForm } from '@/components/events/AbuseReportForm';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { tk, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase || !UUID_RE.test(id)) return {};
  const event = await getPublicEvent(supabase, id);
  if (!event) return {};
  return { title: `${eventTitle(event, tk)} — ${placeLabel(event, locale)}` };
}

const VERIFICATION_METHOD_KEYS: Record<string, string> = {
  moderator_review: 'role.moderator',
  trusted_contributor: 'role.trusted_contributor',
  partner: 'role.partner',
  official_source: 'sourceKind.official',
  satellite_correlation: 'event.satelliteEvidence',
  multiple_reports: 'status.corroborated',
  seismic_network: 'sourceKind.seismic',
};

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { t, tk, locale } = await getI18n();
  const { supabase, user } = await getSession();
  if (!supabase) notFound();
  const event = await getPublicEvent(supabase, id);
  if (!event) notFound();

  const [timeline, verifications, media] = await Promise.all([
    getEventTimeline(supabase, id),
    getEventVerifications(supabase, id),
    getEventMedia(supabase, id),
  ]);
  const env = getPublicEnv();
  const title = eventTitle(event, tk);
  const displayClass = displayClassFor(event.sourceKind, event.status);
  const markerClass =
    displayClass === 'unverified' || displayClass === 'institutional' ? displayClass : 'community';
  const unverified = event.status === 'received' || event.status === 'under_review';
  const publicBucketUrl = env.supabaseUrl
    ? `${env.supabaseUrl}/storage/v1/object/public/report-media-public`
    : null;

  return (
    <main className="page container stack" id="contenu">
      <nav className="small">
        <Link href="/alertes">← {t('alerts.title')}</Link>
      </nav>
      <header className="row" style={{ alignItems: 'flex-start' }}>
        <CategoryIcon categoryId={event.categoryId} withBackground size={26} />
        <div className="stack-sm" style={{ gap: 6 }}>
          <h1 style={{ margin: 0 }}>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            <MapPin size={16} aria-hidden="true" />{' '}
            {placeLabel(event, locale) || t('common.unknown')}
          </p>
          <div className="row">
            {event.isDemo && <DemoBadge t={t} />}
            <SeverityBadge severity={event.severity} t={t} />
            <StatusBadge status={event.status} t={t} />
            <SourceBadge sourceKind={event.sourceKind} status={event.status} t={t} />
          </div>
        </div>
      </header>

      {event.status === 'resolved' && (
        <div className="banner banner-success" role="status">
          <p>{t('event.resolvedBanner')}</p>
        </div>
      )}
      {unverified && (
        <div className="banner banner-warning" role="note">
          <p>{t('event.unverifiedWarning')}</p>
        </div>
      )}
      {event.isDemo && (
        <div className="banner banner-demo" role="note">
          <p>{t('demo.banner')}</p>
        </div>
      )}

      <div className="grid-2">
        <section className="stack-sm">
          <SingleEventMap
            lat={event.lat}
            lng={event.lng}
            categoryId={event.categoryId}
            markerClass={markerClass}
            uncertaintyM={event.uncertaintyM}
            label={`${title} — ${placeLabel(event, locale)}`}
          />
          <Link href={`/carte?lat=${event.lat}&lng=${event.lng}&z=13`} className="small">
            {t('event.viewOnMap')}
          </Link>
        </section>

        <section className="card stack-sm" aria-labelledby="facts-title">
          <h2 id="facts-title">{t('common.details')}</h2>
          <dl className="stack-sm" style={{ margin: 0 }}>
            <div>
              <dt className="small muted">{t('event.started')}</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(event.startedAt, locale)}</dd>
            </div>
            <div>
              <dt className="small muted">{t('event.updated')}</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(event.lastActivityAt, locale)}</dd>
            </div>
            {event.uncertaintyM > 0 && (
              <div>
                <dt className="small muted">{t('event.precision')}</dt>
                <dd style={{ margin: 0 }}>
                  {t('event.approxRadius', {
                    distance: formatDistance(event.uncertaintyM, locale === 'ar' ? 'ar' : 'fr'),
                  })}
                </dd>
              </div>
            )}
            {event.magnitude !== null && (
              <>
                <div>
                  <dt className="small muted">{t('event.magnitude')}</dt>
                  <dd style={{ margin: 0 }}>M {event.magnitude}</dd>
                </div>
                {event.depthKm !== null && (
                  <div>
                    <dt className="small muted">{t('event.depth')}</dt>
                    <dd style={{ margin: 0 }}>{t('event.depthKm', { depth: event.depthKm })}</dd>
                  </div>
                )}
                <div>
                  <dt className="small muted">{t('event.utcTime')}</dt>
                  <dd style={{ margin: 0 }}>{formatUtc(event.startedAt)}</dd>
                </div>
              </>
            )}
            <div>
              <dt className="small muted">{t('event.source')}</dt>
              <dd style={{ margin: 0 }}>
                {tk(`sourceKind.${event.sourceKind}`)}
                {event.reportCount > 0
                  ? ` · ${t('event.reports', { count: event.reportCount })}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="small muted">{t('event.coordinates')}</dt>
              <dd style={{ margin: 0 }}>
                {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
              </dd>
            </div>
          </dl>
          {event.externalUrl && (
            <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} aria-hidden="true" /> {t('event.originLink')}
            </a>
          )}
          {event.categoryId === 'earthquake' && (
            <p className="small muted">{t('event.seismicNoPrediction')}</p>
          )}
        </section>
      </div>

      {event.publicNote && (
        <section className="card" aria-labelledby="note-title">
          <h2 id="note-title">{t('event.publicNote')}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{event.publicNote}</p>
        </section>
      )}

      {media.length > 0 && publicBucketUrl && (
        <section className="stack-sm" aria-label={t('admin.media')}>
          <div className="row">
            {media.map((m) => (
              // Images servies depuis le bucket public (copies ré-encodées sans métadonnées EXIF).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={`${publicBucketUrl}/${m.public_path}`}
                alt={title}
                width={m.width ?? undefined}
                height={m.height ?? undefined}
                loading="lazy"
                style={{ maxWidth: 320, height: 'auto', borderRadius: 12 }}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
        <section className="card stack-sm" aria-labelledby="history-title">
          <h2 id="history-title">{t('event.history')}</h2>
          {timeline.length === 0 ? (
            <p className="muted">{t('event.timelineEmpty')}</p>
          ) : (
            <ol className="timeline">
              {timeline.map((u) => (
                <li key={u.id}>
                  <div className="small muted">{formatDateTime(u.created_at, locale)}</div>
                  <div>
                    {u.kind === 'created' && u.new_status && tk(`status.${u.new_status}`)}
                    {u.kind === 'status_change' && u.new_status && tk(`status.${u.new_status}`)}
                    {u.kind === 'severity_change' &&
                      u.new_severity &&
                      `${t('admin.changeSeverity')} : ${tk(`severity.${u.new_severity}`)}`}
                    {u.kind === 'note' && t('event.publicNote')}
                  </div>
                  {u.message && <p className="small">{u.message}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card stack-sm" aria-labelledby="verif-title">
          <h2 id="verif-title">{t('event.verification')}</h2>
          {verifications.length === 0 ? (
            <p className="muted">{t('status.under_review')}</p>
          ) : (
            <ul className="list-plain stack-sm small">
              {verifications.map((v) => (
                <li key={v.id}>
                  <strong>{tk(VERIFICATION_METHOD_KEYS[v.method] ?? 'common.unknown')}</strong> ·{' '}
                  {formatDateTime(v.created_at, locale)}
                  {v.note ? <div>{v.note}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="banner banner-info" role="note">
        <p className="small">{t('event.notOfficial')}</p>
      </div>

      <div className="row">
        <ShareButton
          url={`${env.siteUrl}/alertes/${event.id}`}
          title={title}
          labels={{
            share: t('event.share'),
            copied: t('common.linkCopied'),
            copy: t('common.copyLink'),
          }}
        />
      </div>
      {user ? (
        <AbuseReportForm targetType="event" targetId={event.id} locale={locale} />
      ) : (
        <p className="small muted">
          <Link href={`/connexion?next=/alertes/${event.id}`}>{t('common.signIn')}</Link> —{' '}
          {t('event.reportAbuse' as TranslationKey)}
        </p>
      )}
    </main>
  );
}
