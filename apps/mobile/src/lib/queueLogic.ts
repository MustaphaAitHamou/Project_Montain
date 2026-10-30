import { type QueuedReport, isPermanentRejection } from '@tamurt/shared';

/**
 * Logique pure de la file hors ligne (testée sans React Native).
 * Un même identifiant client n'apparaît qu'une fois : un renvoi ne crée jamais de doublon.
 */
export function upsertQueued(queue: readonly QueuedReport[], item: QueuedReport): QueuedReport[] {
  return [...queue.filter((r) => r.p_client_id !== item.p_client_id), item];
}

export type SubmitOutcome = { ok: true } | { ok: false; message: string; network: boolean };

/**
 * Après une tentative d'envoi : l'élément quitte la file s'il a été accepté ou s'il est
 * définitivement refusé (hors zone, contenu invalide…). Les erreurs réseau ou temporaires
 * (limite de débit) le laissent en file pour un prochain essai.
 */
export function shouldDequeue(outcome: SubmitOutcome): boolean {
  if (outcome.ok) return true;
  if (outcome.network) return false;
  return isPermanentRejection(outcome.message);
}

/** Les erreurs de transport de fetch (React Native) ne portent pas de code SQL. */
export function isNetworkErrorMessage(message: string): boolean {
  return /network request failed|failed to fetch|network error|timeout|aborted/i.test(message);
}
