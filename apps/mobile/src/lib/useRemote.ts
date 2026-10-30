import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from './cache';

export interface RemoteState<T> {
  data: T | null;
  /** Date de la donnée affichée (réception réseau ou enregistrement local). */
  savedAt: string | null;
  /** Vrai si la donnée affichée provient du cache local faute de réponse du serveur. */
  fromCache: boolean;
  error: boolean;
  loading: boolean;
  refreshing: boolean;
}

async function fetchAndStore<T>(fetcher: () => Promise<T>, cacheKey: string | null) {
  const value = await fetcher();
  const savedAt = cacheKey ? await writeCache(cacheKey, value) : new Date().toISOString();
  return { value, savedAt };
}

/**
 * Charge une ressource distante avec repli sur le cache local. Le `fetcher` doit être
 * stable (useCallback) ; `cacheKey` à null désactive le cache (données non mises en cache).
 */
export function useRemote<T>(cacheKey: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<RemoteState<T>>({
    data: null,
    savedAt: null,
    fromCache: false,
    error: false,
    loading: true,
    refreshing: false,
  });
  const generation = useRef(0);

  // Les mises à jour d'état ne se font que dans des callbacks de promesses (jamais en synchrone).
  const run = useCallback(
    (useCache: boolean) => {
      const current = ++generation.current;
      const isCurrent = () => current === generation.current;
      if (useCache && cacheKey) {
        void readCache<T>(cacheKey).then((cached) => {
          if (!cached || !isCurrent()) return;
          setState((s) =>
            s.data === null
              ? { ...s, data: cached.value, savedAt: cached.savedAt, fromCache: true }
              : s,
          );
        });
      }
      return fetchAndStore(fetcher, cacheKey).then(
        ({ value, savedAt }) => {
          if (isCurrent()) {
            setState({
              data: value,
              savedAt,
              fromCache: false,
              error: false,
              loading: false,
              refreshing: false,
            });
          }
        },
        () => {
          if (isCurrent())
            setState((s) => ({ ...s, error: true, loading: false, refreshing: false }));
        },
      );
    },
    [cacheKey, fetcher],
  );

  useEffect(() => {
    void run(true);
  }, [run]);

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, refreshing: true }));
    return run(false);
  }, [run]);

  return { ...state, refresh };
}
