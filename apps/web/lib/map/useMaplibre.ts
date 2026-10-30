'use client';

import { useEffect, useState, type RefObject } from 'react';
import {
  AttributionControl,
  Map as MaplibreMap,
  NavigationControl,
  getVersion,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getPublicEnv } from '@/lib/env';
import { fallbackStyle, loadCommuneBoundaries, prefersDark } from './style';
import { handleMissingClusterImages, registerMarkerImages } from './markers';

export interface UseMaplibreOptions {
  center: { lat: number; lng: number };
  zoom: number;
  interactive?: boolean;
  /** Carte intégrée dans une page défilante : défilement à deux doigts / Ctrl+molette. */
  cooperative?: boolean;
  showBoundaries?: boolean;
}

export interface MaplibreState {
  map: MaplibreMap | null;
  /** Incrémenté à chaque chargement de style : les couches doivent alors être (ré)ajoutées. */
  styleVersion: number;
  usingFallback: boolean;
}

function addBoundaries(map: MaplibreMap, visible: boolean) {
  void loadCommuneBoundaries().then((data) => {
    if (!data || map.getSource('communes')) return;
    map.addSource('communes', { type: 'geojson', data });
    const dark = prefersDark();
    const beforeId = map.getLayer('events-clusters') ? 'events-clusters' : undefined;
    map.addLayer(
      {
        id: 'communes-fill',
        type: 'fill',
        source: 'communes',
        paint: { 'fill-color': dark ? '#24394a' : '#ffffff', 'fill-opacity': 0.55 },
        layout: { visibility: visible ? 'visible' : 'none' },
      },
      beforeId,
    );
    map.addLayer(
      {
        id: 'communes-line',
        type: 'line',
        source: 'communes',
        paint: {
          'line-color': dark ? '#56B587' : '#2D7B57',
          'line-width': 0.8,
          'line-opacity': 0.7,
        },
        layout: { visibility: visible ? 'visible' : 'none' },
      },
      beforeId,
    );
  });
}

/**
 * Crée une carte MapLibre avec repli automatique : si aucun style n'est configuré,
 * ou si le style distant échoue (réseau, quota, clé), la carte bascule sur un fond
 * simplifié servi par notre backend (contours des communes) et reste utilisable.
 */
export function useMaplibre(
  containerRef: RefObject<HTMLDivElement | null>,
  options: UseMaplibreOptions,
): MaplibreState {
  const [state, setState] = useState<MaplibreState>({
    map: null,
    styleVersion: 0,
    usingFallback: false,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
    const dark = prefersDark();
    const styleUrl = getPublicEnv().mapStyleUrl;
    let usingFallback = !styleUrl;

    const map = new MaplibreMap({
      container,
      style: styleUrl ?? fallbackStyle(dark),
      center: [options.center.lng, options.center.lat],
      zoom: options.zoom,
      interactive: options.interactive ?? true,
      attributionControl: false,
      cooperativeGestures: options.cooperative ?? false,
      maxZoom: 17,
    });

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
        addBoundaries(map, options.showBoundaries ?? usingFallback);
        setState((s) => ({ map, styleVersion: s.styleVersion + 1, usingFallback }));
      });
    });

    setState({ map, styleVersion: 0, usingFallback });
    return () => {
      window.clearTimeout(timeout);
      map.remove();
    };
    // La carte est créée une seule fois ; les changements d'options passent par l'API MapLibre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
