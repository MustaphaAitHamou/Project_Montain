'use client';

import type { StyleSpecification } from 'maplibre-gl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { KABYLIE_REGION } from '@tamurt/shared';

/**
 * Fond de carte de repli, sans aucune ressource externe : couleur de fond + contours
 * des communes (référentiel OSM servi par notre propre backend). Utilisé si aucun
 * fournisseur de tuiles n'est configuré ou si le style distant ne se charge pas.
 */
export function fallbackStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': dark ? '#16222b' : '#e8efe9' },
      },
    ],
  };
}

let boundariesPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;

export function loadCommuneBoundaries(): Promise<GeoJSON.FeatureCollection | null> {
  boundariesPromise ??= (async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('commune_boundaries_geojson', {
      p_wilaya_codes: [...KABYLIE_REGION.wilayaCodes],
    });
    if (error || !data) {
      boundariesPromise = null;
      return null;
    }
    return data as unknown as GeoJSON.FeatureCollection;
  })();
  return boundariesPromise;
}

export function prefersDark(): boolean {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
