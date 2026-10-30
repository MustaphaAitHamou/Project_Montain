'use client';

import { useMemo, useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getPublicEnv } from '@/lib/env';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Abonnement aux notifications du navigateur (Web Push, clé VAPID) et envoi d'une
 * notification de test. L'autorisation n'est demandée qu'après un clic explicite.
 */
export function WebPushControls({ locale }: { locale: Locale }) {
  const { t } = useMemo(() => getTranslator(locale), [locale]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const vapidKey = getPublicEnv().vapidPublicKey;
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const subscribe = async () => {
    setMessage(null);
    if (!supported) return setMessage(t('notifications.webPushNotSupported'));
    if (!vapidKey) return setMessage(t('notifications.webPushNotConfigured'));
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(t('notifications.permissionDenied'));
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));
      const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      const supabase = getSupabaseBrowserClient();
      const { error } = (await supabase?.rpc('register_push_token', {
        p_kind: 'webpush',
        p_platform: 'web',
        p_token: json.endpoint ?? '',
        p_web_push_keys: json.keys ?? {},
        p_locale: locale,
      })) ?? { error: new Error('not configured') };
      setMessage(error ? t('common.errorGeneric') : t('common.saved'));
    } catch {
      setMessage(t('common.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' });
      setMessage(res.ok ? t('notifications.testSent') : t('common.errorGeneric'));
    } catch {
      setMessage(t('common.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-sm">
      <div className="row">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void subscribe()}
          disabled={busy}
        >
          <BellRing size={18} aria-hidden="true" /> {t('notifications.webPushEnable')}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void sendTest()}
          disabled={busy}
        >
          <Send size={18} aria-hidden="true" /> {t('notifications.test')}
        </button>
      </div>
      {message && (
        <p className="small" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
