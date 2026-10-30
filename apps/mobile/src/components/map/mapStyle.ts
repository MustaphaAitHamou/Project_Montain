import type { MapProps } from '@maplibre/maplibre-react-native';
import { KABYLIE_REGION } from '@tamurt/shared';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Fond de carte : style distant si EXPO_PUBLIC_MAP_STYLE_URL est fourni, sinon fond de
 * repli sans ressource externe (couleur + contours des communes servis par le backend).
 */
export function mapStyleFor(dark: boolean): MapProps['mapStyle'] {
  if (env.mapStyleUrl) return env.mapStyleUrl;
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

export const usesFallbackStyle = !env.mapStyleUrl;

let boundaries: Promise<GeoJSON.FeatureCollection | null> | null = null;

export function loadCommuneBoundaries(): Promise<GeoJSON.FeatureCollection | null> {
  boundaries ??= (async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('commune_boundaries_geojson', {
      p_wilaya_codes: [...KABYLIE_REGION.wilayaCodes],
    });
    if (error || !data) {
      boundaries = null;
      return null;
    }
    return data as unknown as GeoJSON.FeatureCollection;
  })();
  return boundaries;
}

/** Emprise de la zone couverte, au format attendu par la caméra MapLibre ([O, S, E, N]). */
export const COVERAGE: [number, number, number, number] = [...KABYLIE_REGION.bbox];
