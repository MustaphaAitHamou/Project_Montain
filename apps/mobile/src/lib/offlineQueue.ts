import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { QueuedReport } from '@tamurt/shared';
import { supabase } from './supabase';
import {
  type SubmitOutcome,
  isNetworkErrorMessage,
  shouldDequeue,
  upsertQueued,
} from './queueLogic';

/**
 * Signalements créés hors connexion, conservés sur l'appareil (sans photo) et renvoyés
 * au retour du réseau. Le serveur garantit l'idempotence via `p_client_id`.
 */
const KEY = 'tamurt.reportQueue.v1';
const listeners = new Set<() => void>();

export async function readQueue(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } finally {
    listeners.forEach((l) => l());
  }
}

export async function enqueueReport(item: QueuedReport): Promise<void> {
  await writeQueue(upsertQueued(await readQueue(), item));
}

export async function submitReport(params: Omit<QueuedReport, 'queuedAt'>): Promise<{
  outcome: SubmitOutcome;
  data: { report_id: string; possible_duplicates?: string[] } | null;
}> {
  if (!supabase)
    return {
      outcome: { ok: false, message: 'backend_not_configured', network: false },
      data: null,
    };
  try {
    const { data, error } = await supabase.rpc('submit_report', params);
    if (error) {
      return {
        outcome: {
          ok: false,
          message: error.message,
          network: isNetworkErrorMessage(error.message),
        },
        data: null,
      };
    }
    return {
      outcome: { ok: true },
      data: data as { report_id: string; possible_duplicates?: string[] },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { outcome: { ok: false, message, network: true }, data: null };
  }
}

let flushing = false;

/** Renvoie la file ; sans effet si déjà en cours, hors connexion ou non connecté. */
export async function flushQueue(): Promise<void> {
  if (flushing || !supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  flushing = true;
  try {
    for (const item of await readQueue()) {
      const { queuedAt: _queuedAt, ...params } = item;
      const { outcome } = await submitReport(params);
      if (outcome.ok === false && outcome.network) break; // toujours hors ligne : on réessaiera
      if (shouldDequeue(outcome)) {
        await writeQueue((await readQueue()).filter((r) => r.p_client_id !== item.p_client_id));
      }
    }
  } finally {
    flushing = false;
  }
}

/** Nombre d'éléments en attente + renvoi automatique au retour du réseau. */
export function useQueuedReports(): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    void readQueue().then((q) => setCount(q.length));
  }, []);
  useEffect(() => {
    listeners.add(refresh);
    refresh();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flushQueue();
    });
    return () => {
      listeners.delete(refresh);
      unsubscribe();
    };
  }, [refresh]);
  return count;
}
