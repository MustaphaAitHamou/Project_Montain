'use client';

import type { QueuedReport } from '@tamurt/shared';

export { type QueuedReport, isPermanentRejection } from '@tamurt/shared';

/**
 * File locale des signalements créés hors connexion. Stockée dans localStorage
 * (sans photo), renvoyée au retour du réseau. L'identifiant client garantit qu'un
 * renvoi ne crée jamais de doublon (idempotence côté serveur).
 */
const KEY = 'tamurt.reportQueue.v1';

export function readQueue(): QueuedReport[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedReport[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('tamurt-queue-changed'));
  } catch {
    // Stockage indisponible (navigation privée) : rien à faire.
  }
}

export function enqueueReport(report: QueuedReport): void {
  const items = readQueue().filter((r) => r.p_client_id !== report.p_client_id);
  writeQueue([...items, report]);
}

export function removeFromQueue(clientId: string): void {
  writeQueue(readQueue().filter((r) => r.p_client_id !== clientId));
}
