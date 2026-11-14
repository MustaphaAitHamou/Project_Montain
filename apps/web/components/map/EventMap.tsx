'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Popup, type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import { Crosshair, Layers, RefreshCw, Search } from 'lucide-react';
import {
  ACTIVE_STATUSES,
  assessFreshness,
  CATEGORIES,
  circlePolygon,
  displayClassFor,
  formatDateTime,
  formatRelativeTime,
  KABYLIE_REGION,
  type VerificationStatus,
} from '@tamurt/shared';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { useMaplibre } from '@/lib/map/useMaplibre';
import { markerImageId } from '@/lib/map/markers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { type EventView, eventTitle, placeLabel, toEventView } from '@/lib/events';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

type Period = '24h' | '7d' | '30d';
const PERIOD_HOURS: Record<Period, number> = { '24h': 24, '7d': 168, '30d': 720 };

export interface FollowedArea {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
}

interface ObservationPoint {
  id: string;
  kind: string;
  lat: number;
  lng: number;
  observed_at: string;
  magnitude: number | null;
  depth_km: number | null;
  confidence: string | null;
  source_id: string;
  title: string | null;
}

interface Props {
  locale: Locale;
  initialEvents: EventView[];
  initialFetchedAt: string;
  variant?: 'full' | 'mini';
  followedAreas?: FollowedArea[];
  initialCenter?: { lat: number; lng: number; zoom: number };
}

function eventsToGeoJSON(events: EventView[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => {
      const displayClass = displayClassFor(e.sourceKind, e.status);
      const markerClass =
        displayClass === 'satellite' || displayClass === 'forecast' ? 'community' : displayClass;
      return {
        type: 'Feature',
        id: e.id,
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        properties: {
          id: e.id,
          category: e.categoryId,
          markerClass,
          severity: e.severity,
          image: markerImageId(e.categoryId, markerClass),
        },
      };
    }),
  };
}

export function EventMap({
  locale,
  initialEvents,
  initialFetchedAt,
  variant = 'full',
  followedAreas = [],
  initialCenter,
}: Props) {
  const i18n = useMemo(() => getTranslator(locale), [locale]);
  const { t, tk } = i18n;
  const containerRef = useRef<HTMLDivElement>(null);
  const full = variant === 'full';
  const { map, styleVersion, usingFallback } = useMaplibre(containerRef, {
    center: initialCenter ?? KABYLIE_REGION.center,
    zoom:
      initialCenter?.zoom ?? (full ? KABYLIE_REGION.defaultZoom : KABYLIE_REGION.defaultZoom - 0.5),
    interactive: true,
    cooperative: !full,
  });

  const [events, setEvents] = useState<EventView[]>(initialEvents);
  const [observations, setObservations] = useState<ObservationPoint[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>(initialFetchedAt);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<Period>('7d');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [layers, setLayers] = useState({
    events: true,
    hotspots: true,
    earthquakes: true,
    boundaries: true,
    followed: true,
  });
  const [visibleIds, setVisibleIds] = useState<string[]>(initialEvents.map((e) => e.id));
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    {
      id: string;
      kind: string;
      name_fr: string;
      name_ar: string | null;
      wilaya_name_fr: string | null;
      lat: number;
      lng: number;
    }[]
  >([]);
  const [now, setNow] = useState(() => new Date());

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  // --- Chargement des données (emprise visible, filtres) -------------------------------
  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !map) return;
    const bounds = map.getBounds();
    const statuses: VerificationStatus[] = includeResolved
      ? [...ACTIVE_STATUSES, 'resolved']
      : [...ACTIVE_STATUSES];
    const since = new Date(Date.now() - PERIOD_HOURS[period] * 3600_000).toISOString();
    setLoading(true);
    const [eventsRes, obsRes] = await Promise.all([
      supabase.rpc('events_in_bbox', {
        p_west: bounds.getWest(),
        p_south: bounds.getSouth(),
        p_east: bounds.getEast(),
        p_north: bounds.getNorth(),
        p_categories: categories.size > 0 ? [...categories] : undefined,
        p_statuses: statuses,
        p_since: since,
        p_limit: 500,
      }),
      layers.hotspots || layers.earthquakes
        ? supabase.rpc('observations_in_bbox', {
            p_west: bounds.getWest(),
            p_south: bounds.getSouth(),
            p_east: bounds.getEast(),
            p_north: bounds.getNorth(),
            p_kinds: ['thermal_hotspot', 'earthquake'],
            p_since: since,
            p_limit: 2000,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);
    setLoading(false);
    if (eventsRes.error || obsRes.error) {
      setFetchError(true);
      return;
    }
    setFetchError(false);
    setEvents((eventsRes.data ?? []).map(toEventView).filter((e): e is EventView => e !== null));
    setObservations((obsRes.data ?? []) as ObservationPoint[]);
    setFetchedAt(new Date().toISOString());
  }, [map, categories, period, includeResolved, layers.hotspots, layers.earthquakes]);

  useEffect(() => {
    if (!map) return;
    let timer: number | undefined;
    const onMove = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 400);
    };
    map.on('moveend', onMove);
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 120_000);
    return () => {
      map.off('moveend', onMove);
      window.clearTimeout(timer);
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [map, refresh]);

  // Actualisation en temps réel (événements publiés/modifiés), filtrée par la RLS.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !full) return;
    let timer: number | undefined;
    const channel = supabase
      .channel('public-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_events' }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void refresh(), 1000);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refresh, full]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // --- Sources et couches --------------------------------------------------------------
  useEffect(() => {
    if (!map || styleVersion === 0) return;
    if (!map.getSource('events')) {
      map.addSource('events', {
        type: 'geojson',
        data: eventsToGeoJSON([]),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 13,
      });
      map.addSource('observations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('followed', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'followed-fill',
        type: 'fill',
        source: 'followed',
        paint: { 'fill-color': '#1F58B0', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: 'followed-line',
        type: 'line',
        source: 'followed',
        paint: { 'line-color': '#1F58B0', 'line-width': 2, 'line-dasharray': [2, 2] },
      });
      map.addLayer({
        id: 'earthquakes',
        type: 'circle',
        source: 'observations',
        filter: ['==', ['get', 'kind'], 'earthquake'],
        paint: {
          'circle-color': '#6D4C41',
          'circle-opacity': 0.75,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'magnitude'], 2],
            2,
            6,
            4,
            12,
            6,
            22,
          ],
        },
      });
      map.addLayer({
        id: 'hotspots',
        type: 'symbol',
        source: 'observations',
        filter: ['==', ['get', 'kind'], 'thermal_hotspot'],
        layout: { 'icon-image': 'marker-hotspot', 'icon-allow-overlap': true },
      });
      map.addLayer({
        id: 'events-clusters',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': ['concat', 'cluster-', ['get', 'point_count_abbreviated']],
          'icon-allow-overlap': true,
        },
      });
      map.addLayer({
        id: 'events-points',
        type: 'symbol',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['get', 'image'],
          'icon-allow-overlap': true,
          'icon-size': ['match', ['get', 'severity'], 'critical', 1.25, 'important', 1.1, 1],
          'symbol-sort-key': [
            'match',
            ['get', 'severity'],
            'critical',
            0,
            'important',
            1,
            'vigilance',
            2,
            3,
          ],
        },
      });
    }
  }, [map, styleVersion]);

  useEffect(() => {
    if (!map || styleVersion === 0) return;
    (map.getSource('events') as GeoJSONSource | undefined)?.setData(eventsToGeoJSON(events));
  }, [map, styleVersion, events]);

  useEffect(() => {
    if (!map || styleVersion === 0) return;
    (map.getSource('observations') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: observations.map((o) => ({
        type: 'Feature',
        id: o.id,
        geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
        properties: { id: o.id, kind: o.kind, magnitude: o.magnitude },
      })),
    });
  }, [map, styleVersion, observations]);

  useEffect(() => {
    if (!map || styleVersion === 0) return;
    (map.getSource('followed') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: followedAreas.map((a) => ({
        type: 'Feature',
        geometry: circlePolygon({ lat: a.lat, lng: a.lng }, a.radiusM),
        properties: { label: a.label },
      })),
    });
  }, [map, styleVersion, followedAreas]);

  useEffect(() => {
    if (!map || styleVersion === 0) return;
    const set = (ids: string[], visible: boolean) => {
      for (const id of ids) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    };
    set(['events-points', 'events-clusters'], layers.events);
    set(['hotspots'], layers.hotspots);
    set(['earthquakes'], layers.earthquakes);
    set(['communes-fill', 'communes-line'], layers.boundaries && (usingFallback || full));
    set(['followed-fill', 'followed-line'], layers.followed);
  }, [map, styleVersion, layers, usingFallback, full]);

  // --- Liste accessible des événements visibles -------------------------------------------
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const bounds = map.getBounds();
      setVisibleIds(events.filter((e) => bounds.contains([e.lng, e.lat])).map((e) => e.id));
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  }, [map, events]);

  // --- Interactions ----------------------------------------------------------------------
  useEffect(() => {
    if (!map || styleVersion === 0) return;
    const showEventPopup = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id as string | undefined;
      const event = id ? eventsById.get(id) : undefined;
      if (!event) return;
      const root = document.createElement('div');
      root.className = 'map-popup';
      const title = document.createElement('strong');
      title.textContent = eventTitle(event, tk);
      const place = document.createElement('div');
      place.textContent = placeLabel(event, locale);
      const meta = document.createElement('div');
      meta.textContent = `${tk(`status.${event.status}`)} · ${tk(`severity.${event.severity}`)}`;
      const time = document.createElement('div');
      time.className = 'muted small';
      time.textContent = formatRelativeTime(event.lastActivityAt, locale);
      const link = document.createElement('a');
      link.href = `/alertes/${event.id}`;
      link.textContent = t('common.details');
      root.append(title, place, meta, time, link);
      if (event.isDemo) {
        const demo = document.createElement('span');
        demo.className = 'badge badge-demo';
        demo.textContent = t('demo.badge');
        root.prepend(demo);
      }
      new Popup({ offset: 18, maxWidth: '260px' })
        .setLngLat([event.lng, event.lat])
        .setDOMContent(root)
        .addTo(map);
    };
    const showObservationPopup = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      const obs = observations.find((o) => o.id === id);
      if (!obs) return;
      const root = document.createElement('div');
      root.className = 'map-popup';
      const title = document.createElement('strong');
      const lines: string[] = [];
      if (obs.kind === 'thermal_hotspot') {
        title.textContent = t('map.hotspotLabel');
        lines.push(`${t('event.satellite')} : ${obs.title ?? obs.source_id}`);
        if (obs.confidence) lines.push(`${t('event.confidence')} : ${obs.confidence}`);
        lines.push(t('map.hotspotDisclaimer'));
      } else {
        title.textContent = `${t('category.earthquake')} M${obs.magnitude ?? '?'}`;
        if (obs.depth_km !== null)
          lines.push(`${t('event.depth')} : ${t('event.depthKm', { depth: obs.depth_km })}`);
        lines.push(t('event.seismicNoPrediction'));
      }
      lines.push(formatDateTime(obs.observed_at, locale));
      root.append(title);
      for (const line of lines) {
        const div = document.createElement('div');
        div.className = 'small';
        div.textContent = line;
        root.append(div);
      }
      new Popup({ offset: 12, maxWidth: '280px' })
        .setLngLat([obs.lng, obs.lat])
        .setDOMContent(root)
        .addTo(map);
    };
    const zoomCluster = async (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.cluster_id as number | undefined;
      const source = map.getSource('events') as GeoJSONSource | undefined;
      if (clusterId === undefined || !source || feature?.geometry.type !== 'Point') return;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
    };
    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const reset = () => (map.getCanvas().style.cursor = '');
    map.on('click', 'events-points', showEventPopup);
    map.on('click', 'events-clusters', zoomCluster);
    map.on('click', 'hotspots', showObservationPopup);
    map.on('click', 'earthquakes', showObservationPopup);
    for (const layer of ['events-points', 'events-clusters', 'hotspots', 'earthquakes']) {
      map.on('mouseenter', layer, pointer);
      map.on('mouseleave', layer, reset);
    }
    return () => {
      map.off('click', 'events-points', showEventPopup);
      map.off('click', 'events-clusters', zoomCluster);
      map.off('click', 'hotspots', showObservationPopup);
      map.off('click', 'earthquakes', showObservationPopup);
      for (const layer of ['events-points', 'events-clusters', 'hotspots', 'earthquakes']) {
        map.off('mouseenter', layer, pointer);
        map.off('mouseleave', layer, reset);
      }
    };
  }, [map, styleVersion, eventsById, observations, locale, t, tk]);

  // --- Recherche de lieux et géolocalisation volontaire ---------------------------------------
  useEffect(() => {
    if (!full) return;
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase.rpc('search_places', { q, max_results: 8 });
      setResults((data ?? []) as typeof results);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, full]);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoMessage(t('map.locationUnavailable'));
      return;
    }
    setGeoMessage(t('map.locating'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoMessage(null);
        // La position n'est ni enregistrée ni envoyée au serveur : elle centre seulement la carte.
        map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12 });
      },
      (err) =>
        setGeoMessage(
          err.code === err.PERMISSION_DENIED
            ? t('map.locationDenied')
            : t('map.locationUnavailable'),
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const freshness = assessFreshness(fetchedAt, now);
  // Résultats affichés seulement pour une saisie d'au moins 2 caractères (état dérivé, sans effet).
  const visibleResults = query.trim().length >= 2 ? results : [];
  const visibleEvents = visibleIds
    .map((id) => eventsById.get(id))
    .filter((e): e is EventView => Boolean(e));

  const toggleCategory = (id: string) =>
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={full ? 'map-layout' : 'stack-sm'}>
      {full && (
        <div className="map-toolbar card stack-sm">
          <div className="row" style={{ position: 'relative' }}>
            <label htmlFor="map-search" className="sr-only">
              {t('map.searchLabel')}
            </label>
            <Search size={18} aria-hidden="true" />
            <input
              id="map-search"
              className="input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder={t('map.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="btn btn-outline" onClick={locate}>
              <Crosshair size={18} aria-hidden="true" />
              {t('map.locateMe')}
            </button>
            {visibleResults.length > 0 && (
              <ul
                className="search-results card list-plain"
                role="listbox"
                aria-label={t('map.searchLabel')}
              >
                {visibleResults.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="btn btn-ghost btn-block"
                      style={{ justifyContent: 'flex-start' }}
                      onClick={() => {
                        map?.flyTo({ center: [r.lng, r.lat], zoom: r.kind === 'wilaya' ? 9 : 12 });
                        setResults([]);
                        setQuery(locale === 'ar' && r.name_ar ? r.name_ar : r.name_fr);
                      }}
                    >
                      {locale === 'ar' && r.name_ar ? r.name_ar : r.name_fr}
                      <span className="muted small">
                        {' '}
                        · {tk(`villages.placeType.${r.kind === 'wilaya' ? 'commune' : r.kind}`)}
                        {r.wilaya_name_fr ? ` · ${r.wilaya_name_fr}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {geoMessage && (
            <p className="small" role="status">
              {geoMessage}
            </p>
          )}
          <div className="row" role="group" aria-label={t('alerts.filterCategory')}>
            {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={categories.has(c.id)}
                onClick={() => toggleCategory(c.id)}
              >
                <CategoryIcon categoryId={c.id} size={16} />
                {tk(`category.${c.id}`)}
              </button>
            ))}
          </div>
          <div className="row">
            <label className="small" htmlFor="map-period">
              {t('map.period')}
            </label>
            <select
              id="map-period"
              className="select"
              style={{ width: 'auto' }}
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              <option value="24h">{t('map.period24h')}</option>
              <option value="7d">{t('map.period7d')}</option>
              <option value="30d">{t('map.period30d')}</option>
            </select>
            <label className="checkbox-row small">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
              />
              {t('map.includeResolved')}
            </label>
            <details className="layers-menu">
              <summary className="btn btn-sm btn-outline">
                <Layers size={16} aria-hidden="true" /> {t('map.layers')}
              </summary>
              <div className="card stack-sm" style={{ position: 'absolute', zIndex: 5 }}>
                {(
                  [
                    ['events', t('map.layerEvents')],
                    ['hotspots', t('map.layerHotspots')],
                    ['earthquakes', t('map.layerEarthquakes')],
                    ['boundaries', t('map.layerBoundaries')],
                    ['followed', t('map.layerFollowed')],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="checkbox-row small">
                    <input
                      type="checkbox"
                      checked={layers[key]}
                      onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={full ? 'map-canvas' : 'map-canvas map-canvas-mini'}
        role="region"
        aria-label={t('map.mapLabel')}
      />

      <div className="row-between small">
        <span
          className={freshness.level === 'stale' || fetchError ? 'badge badge-unverified' : 'muted'}
          role="status"
        >
          {fetchError
            ? t('connectivity.backendUnavailable')
            : freshness.level === 'stale'
              ? t('connectivity.staleData', { minutes: freshness.ageMinutes ?? 0 })
              : t('common.lastUpdate', { time: formatDateTime(fetchedAt, locale) })}
        </span>
        <span className="row">
          {loading && <span className="spinner" aria-hidden="true" />}
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void refresh()}>
            <RefreshCw size={16} aria-hidden="true" /> {t('common.refresh')}
          </button>
          {!full && (
            <Link href="/carte" className="btn btn-sm btn-primary">
              {t('home.openMap')}
            </Link>
          )}
        </span>
      </div>
      {usingFallback && <p className="small muted">{t('map.basemapUnavailable')}</p>}

      {full && (
        <>
          <details className="card">
            <summary>
              <strong>{t('map.legend')}</strong>
            </summary>
            <ul className="list-plain stack-sm small" style={{ marginBlockStart: 12 }}>
              <li>
                <span className="legend-dot legend-unverified" /> {t('displayClass.unverified')}
              </li>
              <li>
                <span className="legend-dot legend-community" /> {t('displayClass.community')}
              </li>
              <li>
                <span className="legend-dot legend-institutional" />{' '}
                {t('displayClass.institutional')}
              </li>
              <li>
                <span className="legend-diamond" /> {t('map.hotspotLabel')} —{' '}
                {t('map.hotspotDisclaimer')}
              </li>
              <li>
                <span className="legend-dot legend-quake" /> {t('category.earthquake')} (
                {t('event.magnitude')})
              </li>
            </ul>
          </details>
          <section aria-labelledby="visible-events-title" className="stack-sm">
            <h2 id="visible-events-title">
              {t('map.eventsInView', { count: visibleEvents.length })}
            </h2>
            {visibleEvents.length === 0 ? (
              <p className="muted">{t('home.noAlerts')}</p>
            ) : (
              <ul className="list-plain stack-sm">
                {visibleEvents.slice(0, 50).map((e) => (
                  <li key={e.id}>
                    <Link href={`/alertes/${e.id}`} className="card card-link row">
                      <CategoryIcon categoryId={e.categoryId} withBackground size={18} />
                      <span className="stack-sm" style={{ gap: 2 }}>
                        <strong>{eventTitle(e, tk)}</strong>
                        <span className="small muted">
                          {placeLabel(e, locale)} · {tk(`status.${e.status}`)} ·{' '}
                          {tk(`severity.${e.severity}`)}
                          {e.isDemo ? ` · ${t('demo.badge')}` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
