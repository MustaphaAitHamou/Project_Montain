import { type Severity, minSeverity } from './severity';

/**
 * Statuts de vérification d'un ÉVÉNEMENT (entité publique regroupant des observations).
 * Un signalement brut possède son propre statut de modération (MODERATION_STATUSES).
 */
export const VERIFICATION_STATUSES = [
  'received', // Reçu, non vérifié
  'under_review', // En cours de vérification
  'corroborated', // Recoupé par plusieurs sources
  'confirmed', // Confirmé par une source habilitée
  'rejected', // Rejeté
  'resolved', // Terminé
  'archived', // Archivé
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Statuts considérés comme « actifs » (affichés sur la carte en direct). */
export const ACTIVE_STATUSES: readonly VerificationStatus[] = [
  'received',
  'under_review',
  'corroborated',
  'confirmed',
];

/** Statuts pour lesquels l'information n'est pas encore vérifiée. */
export const UNVERIFIED_STATUSES: readonly VerificationStatus[] = ['received', 'under_review'];

/** Statuts qui ne doivent jamais être visibles publiquement. */
export const HIDDEN_STATUSES: readonly VerificationStatus[] = ['rejected'];

export function isActiveStatus(status: VerificationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isUnverifiedStatus(status: VerificationStatus): boolean {
  return UNVERIFIED_STATUSES.includes(status);
}

/**
 * Plafond de gravité selon le statut de vérification.
 * - Information non vérifiée : au maximum « vigilance ».
 * - Recoupée par plusieurs sources : au maximum « important ».
 * - Seule une confirmation par une source habilitée autorise « critique ».
 * - Rejeté / terminé / archivé : pas de plafond (plus présenté comme une alerte en cours).
 * Cette règle est aussi appliquée en base (trigger) pour ne pas dépendre du client.
 */
const STATUS_SEVERITY_CAP: Record<VerificationStatus, Severity> = {
  received: 'vigilance',
  under_review: 'vigilance',
  corroborated: 'important',
  confirmed: 'critical',
  rejected: 'critical',
  resolved: 'critical',
  archived: 'critical',
};

export function maxSeverityForStatus(status: VerificationStatus): Severity {
  return STATUS_SEVERITY_CAP[status];
}

export function capSeverity(severity: Severity, status: VerificationStatus): Severity {
  return minSeverity(severity, maxSeverityForStatus(status));
}

/** Transitions autorisées pour les modérateurs (contrôlées aussi côté base). */
export const ALLOWED_STATUS_TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> =
  {
    received: ['under_review', 'corroborated', 'confirmed', 'rejected'],
    under_review: ['corroborated', 'confirmed', 'rejected', 'resolved'],
    corroborated: ['under_review', 'confirmed', 'rejected', 'resolved'],
    confirmed: ['resolved', 'corroborated'],
    rejected: ['under_review'],
    resolved: ['archived', 'under_review', 'confirmed'],
    archived: [],
  };

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

/** Statut de modération d'un SIGNALEMENT brut. */
export const MODERATION_STATUSES = [
  'pending', // en attente de modération
  'approved', // validé et rattaché à un événement
  'merged', // doublon rattaché à un événement existant
  'rejected', // rejeté (motif obligatoire)
  'withdrawn', // retiré par son auteur
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const REJECTION_REASONS = [
  'insufficient_information',
  'outside_coverage',
  'duplicate',
  'false_or_misleading',
  'abusive_content',
  'personal_data',
  'not_an_alert',
  'other',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];
