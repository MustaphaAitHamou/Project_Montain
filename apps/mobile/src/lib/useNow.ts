import { useEffect, useState } from 'react';

/** Horodatage courant rafraîchi périodiquement (temps relatif, fraîcheur des données). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
