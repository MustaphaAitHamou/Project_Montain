import { CircleCheck, CircleDashed, Satellite, ShieldCheck, Users } from 'lucide-react';
import {
  type DisplayClass,
  type Severity,
  type SourceKind,
  type VerificationStatus,
  displayClassFor,
  isUnverifiedStatus,
} from '@tamurt/shared';
import type { TranslationKey } from '@tamurt/shared/i18n';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function SeverityBadge({ severity, t }: { severity: Severity; t: T }) {
  return (
    <span className={`badge badge-${severity}`}>
      <span aria-hidden="true">●</span>
      {t(`severity.${severity}` as TranslationKey)}
    </span>
  );
}

export function StatusBadge({ status, t }: { status: VerificationStatus; t: T }) {
  const unverified = isUnverifiedStatus(status);
  return (
    <span className={unverified ? 'badge badge-unverified' : 'badge badge-neutral'}>
      {unverified ? (
        <CircleDashed size={14} aria-hidden="true" />
      ) : (
        <CircleCheck size={14} aria-hidden="true" />
      )}
      {t(`status.${status}` as TranslationKey)}
    </span>
  );
}

const DISPLAY_ICONS: Record<DisplayClass, React.ComponentType<{ size?: number }>> = {
  unverified: CircleDashed,
  community: Users,
  institutional: ShieldCheck,
  satellite: Satellite,
  forecast: CircleDashed,
};

export function SourceBadge({
  sourceKind,
  status,
  t,
}: {
  sourceKind: SourceKind;
  status: VerificationStatus;
  t: T;
}) {
  const displayClass = displayClassFor(sourceKind, status);
  // Le statut « non vérifié » est déjà affiché par StatusBadge : ici on indique la provenance.
  const shownClass =
    displayClass === 'unverified'
      ? sourceKind === 'community'
        ? 'community'
        : 'institutional'
      : displayClass;
  const Icon = DISPLAY_ICONS[shownClass];
  const label =
    displayClass === 'unverified'
      ? t(`sourceKind.${sourceKind}` as TranslationKey)
      : t(`displayClass.${displayClass}` as TranslationKey);
  return (
    <span className="badge badge-neutral">
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

export function DemoBadge({ t }: { t: T }) {
  return <span className="badge badge-demo">{t('demo.badge')}</span>;
}
