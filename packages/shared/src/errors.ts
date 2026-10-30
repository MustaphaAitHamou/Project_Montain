import type { Database } from './database.types';

/**
 * Les fonctions SQL lèvent des erreurs dont le message commence par un code stable
 * (ex. « rate_limited », « outside_coverage »). On extrait ce code pour l'afficher
 * traduit, sans jamais exposer de détail technique à l'utilisateur.
 */
export const KNOWN_ERROR_CODES = [
  'not_authenticated',
  'account_suspended',
  'rate_limited',
  'category_not_reportable',
  'subcategory_invalid',
  'description_too_short',
  'description_too_long',
  'personal_contact_not_allowed',
  'observed_in_future',
  'observed_too_old',
  'location_must_be_precise',
  'invalid_location',
  'outside_coverage',
  'not_found',
  'report_not_pending',
  'edit_window_closed',
  'forbidden',
  'mfa_required',
  'reason_required',
  'severity_exceeds_status_cap',
  'invalid_status_transition',
  'followed_places_limit_reached',
  'unknown_category',
  'appeal_already_open',
  'media_limit_reached',
  'media_not_uploaded',
  'media_type_not_allowed',
  'media_too_large',
  'invalid_token',
  'device_limit_reached',
  'last_admin',
  'invalid_name',
  'category_mismatch',
  'event_not_found',
  'self_moderation_forbidden',
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number] | 'unknown';

export function rpcErrorCode(
  error: { message?: string; code?: string } | null | undefined,
): KnownErrorCode {
  const message = error?.message ?? '';
  const found = KNOWN_ERROR_CODES.find(
    (code) => message.startsWith(code) || message.includes(`${code}:`) || message === code,
  );
  if (found) return found;
  if (error?.code === '42501') return 'forbidden';
  return 'unknown';
}

/** Clé de traduction associée à un code d'erreur (repli : message générique). */
export function errorMessageKey(code: string | undefined): string {
  switch (code) {
    case 'rate_limited':
      return 'report.rateLimited';
    case 'outside_coverage':
      return 'report.outsideCoverage';
    case 'personal_contact_not_allowed':
      return 'validation.no_personal_contact';
    case 'description_too_short':
      return 'validation.description_too_short';
    case 'description_too_long':
      return 'validation.description_too_long';
    case 'observed_in_future':
      return 'validation.observed_in_future';
    case 'observed_too_old':
      return 'validation.observed_too_old';
    case 'location_must_be_precise':
      return 'validation.location_must_be_precise';
    case 'subcategory_invalid':
      return 'validation.subcategory_invalid';
    case 'category_not_reportable':
      return 'validation.category_not_reportable';
    case 'forbidden':
      return 'errors.forbidden';
    case 'self_moderation_forbidden':
      return 'errors.selfModeration';
    case 'mfa_required':
      return 'admin.mfaNeeded';
    case 'followed_places_limit_reached':
      return 'villages.maxReached';
    case 'not_authenticated':
      return 'common.signInRequired';
    default:
      return 'common.errorGeneric';
  }
}

/** Clé de traduction d'une erreur Supabase Auth (codes documentés par GoTrue). */
export function authErrorKey(code: string | undefined, status: number | undefined): string {
  if (code === 'invalid_credentials') return 'auth.invalidCredentials';
  if (code === 'email_not_confirmed') return 'auth.emailNotConfirmed';
  if (code === 'weak_password') return 'auth.weakPassword';
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    status === 429
  ) {
    return 'auth.rateLimited';
  }
  return 'common.errorGeneric';
}

/**
 * Signalement conservé sur l'appareil hors connexion (sans photo), renvoyé au retour du
 * réseau. L'identifiant client garantit qu'un renvoi ne crée jamais de doublon.
 */
export type SubmitReportArgs = Database['public']['Functions']['submit_report']['Args'];
export interface QueuedReport extends SubmitReportArgs {
  queuedAt: string;
}

/** Erreurs définitives : le signalement ne sera jamais accepté tel quel, on le retire de la file. */
export function isPermanentRejection(message: string): boolean {
  return /^(outside_coverage|subcategory_invalid|category_not_reportable|description_|personal_contact|observed_|location_must|invalid_location)/.test(
    message,
  );
}
