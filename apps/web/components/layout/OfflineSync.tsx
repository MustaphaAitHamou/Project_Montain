'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isPermanentRejection, readQueue, removeFromQueue } from '@/lib/offlineQueue';

/**
 * Renvoie les signalements mis en file hors connexion dès que le réseau revient,
 * et enregistre le service worker (repli hors ligne, push) en production.
 */
export function OfflineSync({ locale, signedIn }: { locale: Locale; signedIn: boolean }) {
  const { t } = useMemo(() => getTranslator(locale), [locale]);
  const [pending, setPending] = useState(0);

  const flush = useCallback(async () => {
    const queue = readQueue();
    setPending(queue.length);
    if (!signedIn || queue.length === 0 || !navigator.onLine) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    for (const item of queue) {
      const { queuedAt: _queuedAt, ...params } = item;
      const { error } = await supabase.rpc('submit_report', params);
      if (!error || isPermanentRejection(error.message ?? '')) removeFromQueue(item.p_client_id);
    }
    setPending(readQueue().length);
  }, [signedIn]);

  useEffect(() => {
    const initial = window.setTimeout(() => void flush(), 0);
    const onChange = () => void flush();
    window.addEventListener('online', onChange);
    window.addEventListener('tamurt-queue-changed', onChange);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener('online', onChange);
      window.removeEventListener('tamurt-queue-changed', onChange);
    };
  }, [flush]);

  if (pending === 0) return null;
  return (
    <div className="container" style={{ paddingBlockStart: 12 }}>
      <div className="banner banner-info" role="status">
        <CloudUpload size={20} aria-hidden="true" />
        <p>{t('offline.queued', { count: pending })}</p>
      </div>
    </div>
  );
}
