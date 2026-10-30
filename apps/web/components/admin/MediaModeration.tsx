'use client';

import { useState } from 'react';

/** Boutons de décision sur une photo (route serveur /api/admin/media, rôle vérifié côté serveur). */
export function MediaModeration({ mediaId }: { mediaId: string }) {
  const [state, setState] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setState('…');
    const res = await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaId, approve }),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
    setState(res.ok ? (json.status ?? 'ok') : `Erreur : ${json.error ?? res.status}`);
  };
  return (
    <div className="row">
      <button type="button" className="btn btn-sm btn-primary" onClick={() => void decide(true)}>
        Publier la photo (sans métadonnées)
      </button>
      <button type="button" className="btn btn-sm btn-outline" onClick={() => void decide(false)}>
        Refuser
      </button>
      {state && (
        <span className="small" role="status">
          {state}
        </span>
      )}
    </div>
  );
}
