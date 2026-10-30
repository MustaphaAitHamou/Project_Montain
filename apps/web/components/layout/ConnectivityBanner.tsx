'use client';

import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Bandeau explicite en cas de perte de connexion (données potentiellement périmées). */
export function ConnectivityBanner({ title, detail }: { title: string; detail: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="container" style={{ paddingBlockStart: 12 }}>
      <div className="banner banner-warning" role="alert">
        <WifiOff size={20} aria-hidden="true" />
        <div>
          <strong>{title}</strong>
          <p className="small">{detail}</p>
        </div>
      </div>
    </div>
  );
}
