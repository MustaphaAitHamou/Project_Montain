'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1>Tamurt Alerte est momentanément indisponible</h1>
        <p>En cas de danger immédiat, contactez les services de secours.</p>
        <button type="button" onClick={reset}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
