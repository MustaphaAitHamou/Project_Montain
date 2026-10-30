'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

/** Partage via le menu natif (Web Share API) ou copie du lien en repli. */
export function ShareButton({
  url,
  title,
  labels,
}: {
  url: string;
  title: string;
  labels: { share: string; copied: string; copy: string };
}) {
  const [message, setMessage] = useState<string | null>(null);
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage(labels.copied);
    } catch {
      // Partage annulé par l'utilisateur : rien à faire.
    }
  };
  return (
    <span className="row">
      <button type="button" className="btn btn-outline" onClick={() => void share()}>
        <Share2 size={18} aria-hidden="true" />
        {labels.share}
      </button>
      {message && (
        <span className="small" role="status">
          {message}
        </span>
      )}
    </span>
  );
}
