'use client';

import { useEffect, useState, type RefObject } from 'react';
import {
  AttributionControl,
  Map as MaplibreMap,
  NavigationControl,
  getVersion,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getPublicEnv } from '@/lib/env';
import {
  fallbackStyle,
  geometryBBox,
  loadCommuneBoundaries,
  loadWilayaBoundaries,
  prefersDark,
} from './style';
import { handleMissingClusterImages, registerMarkerImages } from './markers';

/** Zoom à partir duquel le détail des communes est chargé (wilayas visibles seulement). */
export const COMMUNES_MIN_ZOOM = 7;

/** Couches du référentiel : le remplissage ne sert qu'au fond de repli (« terre »). */
export const BOUNDARY_FILL_LAYERS = ['wilayas-fill'] as const;
export const BOUNDARY_LINE_LAYERS = ['wilayas-line', 'communes-line'] as const;

/** Couches de données au-dessus desquelles les contours ne doivent jamais passer. */
const DATA_LAYERS = [
  'followed-fill',
  'earthquakes',
  'hotspots',
  'events-clusters',
  'events-points',
];

export interface UseMaplibreOptions {
  center: { lat: number; lng: number };
  zoom: number;
  /** Emprise à afficher au départ [ouest, sud, est, nord] ; prioritaire sur centre et zoom. */
  bounds?: readonly [number, number, number, number];
  interactive?: boolean;
  /** Carte intégrée dans une page défilante : défilement à deux doigts / Ctrl+molette. */
  cooperative?: boolean;
  showBoundaries?: boolean;
}

export interface MaplibreState {
  map: MaplibreMap | null;
  /** Incrémenté à chaque chargement de style : les couches doivent alors être (ré)ajoutées. */
  styleVersion: number;
  /** Incrémenté quand les couches du référentiel sont ajoutées (chargement asynchrone). */
  boundariesVersion: number;
  usingFallback: boolean;
}

interface WilayaBox {
  code: string;
  box: [number, number, number, number];
}

async function addBoundaries(
  map: MaplibreMap,
  options: { fill: boolean; lines: boolean },
): Promise<WilayaBox[] | null> {
  const wilayas = await loadWilayaBoundaries();
  if (!wilayas || map.getSource('wilayas')) return null;
  const dark = prefersDark();
  const beforeId = DATA_LAYERS.find((id) => map.getLayer(id));
  map.addSource('wilayas', { type: 'geojson', data: wilayas });
  map.addSource('communes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer(
    {
      id: 'wilayas-fill',
      type: 'fill',
      source: 'wilayas',
      paint: { 'fill-color': dark ? '#24221f' : '#ffffff', 'fill-opacity': dark ? 0.9 : 0.8 },
      layout: { visibility: options.fill ? 'visible' : 'none' },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: 'communes-line',
      type: 'line',
      source: 'communes',
      minzoom: COMMUNES_MIN_ZOOM,
      paint: {
        'line-color': dark ? '#5c5852' : '#b5afa6',
        'line-width': 0.7,
        'line-opacity': 0.8,
      },
      layout: { visibility: options.lines ? 'visible' : 'none' },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: 'wilayas-line',
      type: 'line',
      source: 'wilayas',
      paint: {
        'line-color': dark ? '#8c857c' : '#5c5852',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.4],
        'line-opacity': 0.85,
      },
      layout: { visibility: options.lines ? 'visible' : 'none' },
    },
    beforeId,
  );
  return wilayas.features
    .filter((f) => f.geometry)
    .map((f) => ({ code: String(f.properties?.code ?? f.id), box: geometryBBox(f.geometry) }));
}

/**
 * Crée une carte MapLibre avec repli automatique : si aucun style n'est configuré,
 * ou si le style distant échoue (réseau, quota, clé), la carte bascule sur un fond
 * simplifié servi par notre backend (contours des wilayas, puis des communes en zoomant)
 * et reste utilisable.
 */
export function useMaplibre(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseMaplibreOptions,
): MaplibreState {
  const [state, setState] = useState<MaplibreState>({
    map: null,
    styleVersion: 0,
    boundariesVersion: 0,
    usingFallback: false,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
    const dark = prefersDark();
    const styleUrl = getPublicEnv().mapStyleUrl;
    let usingFallback = !styleUrl;
    let wilayaBoxes: WilayaBox[] = [];

    const map = new MaplibreMap({
      container,
      style: styleUrl ?? fallbackStyle(dark),
      ...(options.bounds
        ? { bounds: [...options.bounds], fitBoundsOptions: { padding: 16, maxZoom: 12 } }
        : { center: [options.center.lng, options.center.lat], zoom: options.zoom }),
      interactive: options.interactive ?? true,
      attributionControl: false,
      cooperativeGestures: options.cooperative ?? false,
      minZoom: 2,
      maxZoom: 17,
    });

    // Détail communal : chargé seulement pour les wilayas visibles, à partir d'un zoom suffisant.
    const updateCommunes = () => {
      if (wilayaBoxes.length === 0 || map.getZoom() < COMMUNES_MIN_ZOOM) return;
      const b = map.getBounds();
      const codes = wilayaBoxes
        .filter(
          ({ box }) =>
            box[0] <= b.getEast() &&
            box[2] >= b.getWest() &&
            box[1] <= b.getNorth() &&
            box[3] >= b.getSouth(),
        )
        .map((w) => w.code);
      if (codes.length === 0) return;
      void loadCommuneBoundaries(codes).then((data) => {
        (map.getSource('communes') as GeoJSONSource | undefined)?.setData(data);
      });
    };
    map.on('moveend', updateCommunes);

    const applyFallback = () => {
      if (usingFallback) return;
      usingFallback = true;
      setState((s) => ({ ...s, usingFallback: true }));
      map.setStyle(fallbackStyle(dark));
    };
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) applyFallback();
    }, 8000);
    map.on('error', () => {
      if (!map.isStyleLoaded()) applyFallback();
    });

    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }),
    );
    if (options.interactive ?? true) {
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    }
    handleMissingClusterImages(map);

    map.on('style.load', () => {
      void registerMarkerImages(map).then(() => {
        const lines = options.showBoundaries ?? usingFallback;
        void addBoundaries(map, { fill: usingFallback, lines }).then((boxes) => {
          if (!boxes) return;
          wilayaBoxes = boxes;
          updateCommunes();
          setState((s) => ({ ...s, boundariesVersion: s.boundariesVersion + 1 }));
        });
        setState((s) => ({ ...s, map, styleVersion: s.styleVersion + 1, usingFallback }));
      });
    });

    setState({ map, styleVersion: 0, boundariesVersion: 0, usingFallback });
    return () => {
      window.clearTimeout(timeout);
      map.off('moveend', updateCommunes);
      map.remove();
    };
    // La carte est créée une seule fois ; les changements d'options passent par l'API MapLibre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
