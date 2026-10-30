/**
 * Niveaux de gravité d'un événement. L'ordre du tableau définit le rang (0 = le plus faible).
 * Règle produit : un simple signalement non vérifié ne reçoit jamais automatiquement
 * la gravité maximale (voir `maxSeverityForStatus` dans statuses.ts).
 */
export const SEVERITIES = ['information', 'vigilance', 'important', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export function severityRank(severity: Severity): number {
  return SEVERITIES.indexOf(severity);
}

export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

/** Retourne la gravité la plus faible des deux (utile pour appliquer un plafond). */
export function minSeverity(a: Severity, b: Severity): Severity {
  return severityRank(a) <= severityRank(b) ? a : b;
}

export function maxSeverity(a: Severity, b: Severity): Severity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

export function isAtLeast(severity: Severity, threshold: Severity): boolean {
  return severityRank(severity) >= severityRank(threshold);
}
