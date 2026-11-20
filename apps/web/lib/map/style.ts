'use client';

import type { StyleSpecification } from 'maplibre-gl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Fond de carte de repli, sans aucune ressource externe : couleur de fond + contours
 * des wilayas et des communes (référentiel OSM servi par notre propre backend). Utilisé si
 * aucun fournisseur de tuiles n'est configuré ou si le style distant ne se charge pas.
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

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

let wilayasPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;

/** Contours simplifiés des 69 wilayas (léger : chargé une fois pour tout le pays). */
export function loadWilayaBoundaries(): Promise<GeoJSON.FeatureCollection | null> {
  wilayasPromise ??= (async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('wilaya_boundaries_geojson', {});
    if (error || !data) {
      wilayasPromise = null;
      return null;
    }
    return data as unknown as GeoJSON.FeatureCollection;
  })();
  return wilayasPromise;
}

/** Contours des communes, chargés par wilaya à la demande puis gardés en mémoire. */
const communesByWilaya = new Map<string, Promise<GeoJSON.Feature[]>>();

export async function loadCommuneBoundaries(
  wilayaCodes: readonly string[],
): Promise<GeoJSON.FeatureCollection> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return EMPTY;
  const missing = wilayaCodes.filter((code) => !communesByWilaya.has(code));
  if (missing.length > 0) {
    const request = (async () => {
      const { data, error } = await supabase.rpc('commune_boundaries_geojson', {
        p_wilaya_codes: missing,
      });
      if (error || !data) {
        for (const code of missing) communesByWilaya.delete(code);
        return [];
      }
      return (data as unknown as GeoJSON.FeatureCollection).features;
    })();
    for (const code of missing) {
      communesByWilaya.set(
        code,
        request.then((features) => features.filter((f) => f.properties?.wilaya_code === code)),
      );
    }
  }
  const features = await Promise.all([...communesByWilaya.values()]);
  return { type: 'FeatureCollection', features: features.flat() };
}

type Ring = GeoJSON.Position[];

/** Emprise [ouest, sud, est, nord] d'une géométrie (polygone ou multipolygone). */
export function geometryBBox(geometry: GeoJSON.Geometry): [number, number, number, number] {
  const box: [number, number, number, number] = [180, 90, -180, -90];
  const visit = (ring: Ring) => {
    for (const [lng, lat] of ring) {
      if (lng === undefined || lat === undefined) continue;
      box[0] = Math.min(box[0], lng);
      box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lng);
      box[3] = Math.max(box[3], lat);
    }
  };
  if (geometry.type === 'Polygon') geometry.coordinates.forEach(visit);
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.flat().forEach(visit);
  return box;
}

export function prefersDark(): boolean {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return true;
  if (attr === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
