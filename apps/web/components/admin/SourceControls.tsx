'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SourceControls({ sourceId, enabled }: { sourceId: string; enabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const call = async (action: 'sync' | 'enable' | 'disable') => {
    setMessage('…');
    const res = await fetch('/api/admin/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, action }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    setMessage(res.ok ? JSON.stringify(json) : `Erreur : ${String(json.error ?? res.status)}`);
    router.refresh();
  };
  return (
    <div className="stack-sm">
      <div className="row">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void call('sync')}>
          Synchroniser maintenant
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => void call(enabled ? 'disable' : 'enable')}
        >
          {enabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>
      {message && (
        <code
          className="small"
          role="status"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {message}
        </code>
      )}
    </div>
  );
}
