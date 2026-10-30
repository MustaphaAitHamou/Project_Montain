'use client';

import { useEffect, useRef, useState } from 'react';
import { Marker, type GeoJSONSource } from 'maplibre-gl';
import { Crosshair, Search } from 'lucide-react';
import { circlePolygon, KABYLIE_REGION } from '@tamurt/shared';
import { useMaplibre } from '@/lib/map/useMaplibre';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface LatLngValue {
  lat: number;
  lng: number;
}

interface Labels {
  useGps: string;
  gpsHint: string;
  tapToPlace: string;
  locating: string;
  denied: string;
  unavailable: string;
  searchPlaceholder: string;
  searchLabel: string;
  mapLabel: string;
}

interface SearchResult {
  id: string;
  kind: string;
  name_fr: string;
  wilaya_name_fr: string | null;
  lat: number;
  lng: number;
}

/**
 * Sélection d'une position sur la carte. La position GPS n'est qu'une suggestion :
 * l'utilisateur place le marqueur sur le phénomène (qui peut être loin de lui).
 */
export function LocationPicker({
  value,
  onChange,
  uncertaintyM,
  labels,
}: {
  value: LatLngValue | null;
  onChange: (value: LatLngValue) => void;
  uncertaintyM: number;
  labels: Labels;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const { map, styleVersion } = useMaplibre(containerRef, {
    center: value ?? KABYLIE_REGION.center,
    zoom: value ? 13 : KABYLIE_REGION.defaultZoom,
    showBoundaries: true,
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
      onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new Marker({ draggable: true, color: '#C62828' })
        .setLngLat([value.lng, value.lat])
        .addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        onChangeRef.current({ lat: pos.lat, lng: pos.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
  }, [map, value]);

  useEffect(() => {
    if (!map || styleVersion === 0) return;
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: value
        ? [
            {
              type: 'Feature',
              geometry: circlePolygon(value, Math.max(uncertaintyM, 30)),
              properties: {},
            },
          ]
        : [],
    };
    const source = map.getSource('uncertainty') as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource('uncertainty', { type: 'geojson', data });
    map.addLayer({
      id: 'uncertainty-fill',
      type: 'fill',
      source: 'uncertainty',
      paint: { 'fill-color': '#C62828', 'fill-opacity': 0.12 },
    });
    map.addLayer({
      id: 'uncertainty-line',
      type: 'line',
      source: 'uncertainty',
      paint: { 'line-color': '#C62828', 'line-width': 1.5, 'line-dasharray': [2, 2] },
    });
  }, [map, styleVersion, value, uncertaintyM]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = (await supabase?.rpc('search_places', { q, max_results: 6 })) ?? {
        data: [],
      };
      setResults((data ?? []) as SearchResult[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visibleResults = query.trim().length >= 2 ? results : [];

  const useGps = () => {
    if (!navigator.geolocation) {
      setMessage(labels.unavailable);
      return;
    }
    setMessage(labels.locating);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMessage(labels.gpsHint);
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map?.flyTo({ center: [point.lng, point.lat], zoom: 14 });
        onChangeRef.current(point);
      },
      (err) => setMessage(err.code === err.PERMISSION_DENIED ? labels.denied : labels.unavailable),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <div className="stack-sm">
      <div className="row" style={{ position: 'relative' }}>
        <label htmlFor="picker-search" className="sr-only">
          {labels.searchLabel}
        </label>
        <Search size={18} aria-hidden="true" />
        <input
          id="picker-search"
          className="input"
          style={{ flex: 1, minWidth: 160 }}
          placeholder={labels.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <button type="button" className="btn btn-outline" onClick={useGps}>
          <Crosshair size={18} aria-hidden="true" />
          {labels.useGps}
        </button>
        {visibleResults.length > 0 && (
          <ul className="search-results card list-plain">
            {visibleResults.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    map?.flyTo({ center: [r.lng, r.lat], zoom: 13 });
                    setResults([]);
                    setQuery(r.name_fr);
                  }}
                >
                  {r.name_fr}
                  <span className="muted small"> · {r.wilaya_name_fr ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="small muted">{message ?? labels.tapToPlace}</p>
      <div
        ref={containerRef}
        className="map-canvas"
        style={{ height: 380, minHeight: 300 }}
        role="application"
        aria-label={labels.mapLabel}
      />
      {value && (
        <p className="small muted">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
