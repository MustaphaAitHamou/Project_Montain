'use client';

import { useEffect, useRef } from 'react';
import { circlePolygon } from '@tamurt/shared';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMaplibre } from '@/lib/map/useMaplibre';
import { markerImageId } from '@/lib/map/markers';

interface Props {
  lat: number;
  lng: number;
  categoryId: string;
  markerClass: 'unverified' | 'community' | 'institutional';
  uncertaintyM: number;
  label: string;
}

/** Mini-carte d'un événement : marqueur + cercle d'incertitude de localisation. */
export function SingleEventMap({ lat, lng, categoryId, markerClass, uncertaintyM, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { map, styleVersion } = useMaplibre(ref, {
    center: { lat, lng },
    zoom: uncertaintyM > 3000 ? 10 : 12,
    cooperative: true,
  });

  useEffect(() => {
    if (!map || styleVersion === 0) return;
    const point: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { image: markerImageId(categoryId, markerClass) },
    };
    const area: GeoJSON.Feature = {
      type: 'Feature',
      geometry: circlePolygon({ lat, lng }, Math.max(uncertaintyM, 50)),
      properties: {},
    };
    const existing = map.getSource('single') as GeoJSONSource | undefined;
    if (existing) {
      existing.setData({ type: 'FeatureCollection', features: [area, point] });
      return;
    }
    map.addSource('single', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [area, point] },
    });
    map.addLayer({
      id: 'single-area',
      type: 'fill',
      source: 'single',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.15 },
    });
    map.addLayer({
      id: 'single-area-line',
      type: 'line',
      source: 'single',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': '#B45309', 'line-width': 1.5, 'line-dasharray': [2, 2] },
    });
    map.addLayer({
      id: 'single-point',
      type: 'symbol',
      source: 'single',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: { 'icon-image': ['get', 'image'], 'icon-allow-overlap': true },
    });
  }, [map, styleVersion, lat, lng, categoryId, markerClass, uncertaintyM]);

  return <div ref={ref} className="map-canvas map-canvas-mini" role="img" aria-label={label} />;
}
