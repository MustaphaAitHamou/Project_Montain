'use client';

import { useEffect } from 'react';

/** Erreur inattendue : message compréhensible, sans détail technique. */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error.digest ?? 'erreur');
  }, [error]);
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 560 }}>
      <h1>Une erreur est survenue</h1>
      <p>
        La page n’a pas pu être affichée. Les informations d’alerte peuvent être incomplètes :
        réessayez dans un instant.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Réessayer
      </button>
    </main>
  );
}
