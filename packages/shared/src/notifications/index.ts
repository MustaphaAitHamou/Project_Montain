import type { CategoryId } from '../domain/categories';
import { getCategory } from '../domain/categories';
import { type Severity, isAtLeast, severityRank } from '../domain/severity';
import {
  type VerificationStatus,
  VERIFICATION_STATUSES,
  isUnverifiedStatus,
} from '../domain/statuses';

/** Raison d'une notification liée à un événement. */
export const NOTIFICATION_REASONS = [
  'published', // nouvel événement visible
  'status_upgraded', // passage à « recoupé » ou « confirmé »
  'severity_raised', // gravité relevée
  'resolved', // fin d'incident
] as const;
export type NotificationReason = (typeof NOTIFICATION_REASONS)[number];

export interface EventSnapshot {
  status: VerificationStatus;
  severity: Severity;
  isPublic: boolean;
}

const STATUS_STRENGTH: Partial<Record<VerificationStatus, number>> = {
  received: 0,
  under_review: 1,
  corroborated: 2,
  confirmed: 3,
};

/**
 * Détermine si un changement d'événement justifie une notification.
 * Retourne `null` si aucune notification ne doit être produite.
 */
export function notificationReasonFor(
  before: EventSnapshot | null,
  after: EventSnapshot,
): NotificationReason | null {
  if (!after.isPublic || after.status === 'rejected' || after.status === 'archived') return null;
  if (!before || !before.isPublic) {
    return after.status === 'resolved' ? null : 'published';
  }
  if (after.status === 'resolved' && before.status !== 'resolved') return 'resolved';
  const b = STATUS_STRENGTH[before.status];
  const a = STATUS_STRENGTH[after.status];
  if (a !== undefined && b !== undefined && a > b && a >= 2) return 'status_upgraded';
  if (severityRank(after.severity) > severityRank(before.severity)) return 'severity_raised';
  return null;
}

/** Clé de déduplication : une seule notification par utilisateur et par changement. */
export function buildDedupKey(
  eventId: string,
  reason: NotificationReason,
  version: number,
): string {
  return `${eventId}:${reason}:${version}`;
}

function localMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Vrai si `date` tombe dans la plage silencieuse (gère les plages qui passent minuit). */
export function isWithinQuietHours(
  date: Date,
  start: string,
  end: string,
  timeZone: string,
): boolean {
  const now = localMinutes(date, timeZone);
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

export interface RecipientPreferences {
  pushEnabled: boolean;
  minSeverity: Severity;
  includeUnverified: boolean;
  updatesEnabled: boolean;
  resolutionEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
}

export interface FollowedPlaceFilter {
  categories: readonly CategoryId[];
  minSeverity: Severity | null;
  notify: boolean;
}

export interface NotificationCandidate {
  categoryId: CategoryId;
  status: VerificationStatus;
  severity: Severity;
  reason: NotificationReason;
}

export type DeliveryDecision =
  { notify: false; why: string } | { notify: true; channel: 'push' | 'inbox_only'; why: string };

/**
 * Décision de notification pour un destinataire déjà sélectionné géographiquement
 * (le filtre spatial est fait en base avec PostGIS). Fonction pure, testée unitairement.
 * Note : la boîte de réception in-app reçoit l'information même pendant les heures
 * silencieuses ; seule la notification push est retenue (sauf « critique »).
 */
export function decideDelivery(
  candidate: NotificationCandidate,
  prefs: RecipientPreferences,
  place: FollowedPlaceFilter,
  now: Date,
): DeliveryDecision {
  if (!place.notify) return { notify: false, why: 'place_muted' };
  if (place.categories.length > 0 && !place.categories.includes(candidate.categoryId)) {
    return { notify: false, why: 'category_not_followed' };
  }
  const category = getCategory(candidate.categoryId);
  if (!category.notification.notifiable) return { notify: false, why: 'category_not_notifiable' };

  const threshold = place.minSeverity ?? prefs.minSeverity;
  // Une fin d'incident est toujours « information » : on la laisse passer si l'utilisateur l'accepte.
  if (candidate.reason === 'resolved') {
    if (!prefs.resolutionEnabled) return { notify: false, why: 'resolution_disabled' };
  } else if (!isAtLeast(candidate.severity, threshold)) {
    return { notify: false, why: 'below_min_severity' };
  }
  if (
    (candidate.reason === 'status_upgraded' || candidate.reason === 'severity_raised') &&
    !prefs.updatesEnabled
  ) {
    return { notify: false, why: 'updates_disabled' };
  }

  const unverified = isUnverifiedStatus(candidate.status);
  if (unverified && !prefs.includeUnverified) return { notify: false, why: 'unverified_excluded' };

  const minStatusIndex = VERIFICATION_STATUSES.indexOf(category.notification.minStatusForPush);
  const statusIndex = VERIFICATION_STATUSES.indexOf(candidate.status);
  const meetsPushStatus =
    candidate.reason === 'resolved' ||
    (statusIndex >= minStatusIndex && statusIndex <= VERIFICATION_STATUSES.indexOf('confirmed')) ||
    (unverified && prefs.includeUnverified);

  if (!prefs.pushEnabled || !meetsPushStatus) {
    return { notify: true, channel: 'inbox_only', why: 'push_not_applicable' };
  }
  if (
    prefs.quietHoursEnabled &&
    candidate.severity !== 'critical' &&
    isWithinQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd, prefs.timezone)
  ) {
    return { notify: true, channel: 'inbox_only', why: 'quiet_hours' };
  }
  return { notify: true, channel: 'push', why: 'ok' };
}

/** Limite anti-spam : nombre maximal de push non critiques par utilisateur et par heure. */
export const MAX_NON_CRITICAL_PUSH_PER_HOUR = 6;
