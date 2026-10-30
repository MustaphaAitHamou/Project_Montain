import { FRESHNESS_THRESHOLDS } from '../config';

export type Freshness = 'fresh' | 'aging' | 'stale' | 'unknown';

export interface FreshnessAssessment {
  level: Freshness;
  ageMinutes: number | null;
}

/**
 * Évalue la fraîcheur d'une donnée affichée. Les données anciennes ne doivent
 * jamais être présentées comme actuelles : l'interface affiche l'heure exacte
 * de dernière mise à jour et un avertissement si la donnée est périmée.
 */
export function assessFreshness(
  lastUpdatedAt: Date | string | null | undefined,
  now: Date = new Date(),
  thresholds = FRESHNESS_THRESHOLDS,
): FreshnessAssessment {
  if (!lastUpdatedAt) return { level: 'unknown', ageMinutes: null };
  const time =
    typeof lastUpdatedAt === 'string' ? Date.parse(lastUpdatedAt) : lastUpdatedAt.getTime();
  if (Number.isNaN(time)) return { level: 'unknown', ageMinutes: null };
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - time) / 60000));
  if (ageMinutes >= thresholds.staleAfterMinutes) return { level: 'stale', ageMinutes };
  if (ageMinutes >= thresholds.agingAfterMinutes) return { level: 'aging', ageMinutes };
  return { level: 'fresh', ageMinutes };
}
