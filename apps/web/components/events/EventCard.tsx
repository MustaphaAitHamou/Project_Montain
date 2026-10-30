import Link from 'next/link';
import { formatDateTime } from '@tamurt/shared';
import type { Locale, TranslationKey } from '@tamurt/shared/i18n';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { DemoBadge, SeverityBadge, SourceBadge, StatusBadge } from '@/components/ui/Badges';
import { type EventView, eventTitle, placeLabel } from '@/lib/events';

interface Props {
  event: EventView;
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tk: (key: string, params?: Record<string, string | number>) => string;
}

export function EventCard({ event, locale, t, tk }: Props) {
  return (
    <Link href={`/alertes/${event.id}`} className="card card-link event-card">
      <CategoryIcon categoryId={event.categoryId} withBackground size={20} />
      <div style={{ minWidth: 0 }}>
        <strong>{eventTitle(event, tk)}</strong>
        <div className="small muted">{placeLabel(event, locale) || t('common.unknown')}</div>
        <div className="event-meta">
          {event.isDemo && <DemoBadge t={t} />}
          <SeverityBadge severity={event.severity} t={t} />
          <StatusBadge status={event.status} t={t} />
          <SourceBadge sourceKind={event.sourceKind} status={event.status} t={t} />
        </div>
        <div className="small muted" style={{ marginBlockStart: 4 }}>
          {t('event.updated')} : {formatDateTime(event.lastActivityAt, locale)}
          {event.reportCount > 1 ? ` · ${t('event.reports', { count: event.reportCount })}` : ''}
        </div>
      </div>
    </Link>
  );
}
