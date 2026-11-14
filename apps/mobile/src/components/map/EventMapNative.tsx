import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type GeoJSONSourceRef,
} from '@maplibre/maplibre-react-native';
import {
  type BBox,
  type EventView,
  type LatLng,
  circlePolygon,
  displayClassFor,
} from '@tamurt/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { COVERAGE, loadCommuneBoundaries, mapStyleFor, usesFallbackStyle } from './mapStyle';
import {
  categoryColor,
  clusterRadius,
  displayOpacity,
  displayStroke,
  displayStrokeWidth,
  isCluster,
  isPoint,
  severityRadius,
} from './layerTypes';

export interface MapFocus {
  center: LatLng;
  zoom: number;
  /** Incrémenté à chaque demande, pour recentrer même sur le même point. */
  key: number;
}

export interface FollowedArea {
  id: string;
  center: LatLng;
  radiusM: number;
}

/**
 * Carte des événements (MapLibre natif). Les points sont regroupés, colorés par catégorie ;
 * le contour distingue la provenance (communautaire, institutionnelle, satellite, non vérifiée).
 */
export default function EventMapNative({
  events,
  focus,
  followed = [],
  onBoundsChange,
  onSelect,
}: {
  events: EventView[];
  focus: MapFocus | null;
  followed?: FollowedArea[];
  onBoundsChange: (bbox: BBox) => void;
  onSelect: (eventId: string) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const camera = useRef<CameraRef>(null);
  const source = useRef<GeoJSONSourceRef>(null);
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  // Vue initiale : position demandée (lien « Voir sur la carte ») ou toute la zone couverte.
  const [initialView] = useState(() =>
    focus
      ? { center: [focus.center.lng, focus.center.lat] as [number, number], zoom: focus.zoom }
      : { bounds: COVERAGE, padding: { top: 16, right: 16, bottom: 16, left: 16 } },
  );
  const firstFocusKey = useRef(focus?.key ?? 0);

  useEffect(() => {
    if (!usesFallbackStyle) return;
    let alive = true;
    void loadCommuneBoundaries().then((b) => {
      if (alive) setBoundaries(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // La position initiale est déjà appliquée par initialViewState.
    if (!focus || focus.key === firstFocusKey.current) return;
    camera.current?.flyTo({
      center: [focus.center.lng, focus.center.lat],
      zoom: focus.zoom,
      duration: 800,
    });
  }, [focus]);

  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: events.map((e) => ({
        type: 'Feature',
        id: e.id,
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
        properties: {
          id: e.id,
          category: e.categoryId,
          severity: e.severity,
          displayClass: displayClassFor(e.sourceKind, e.status),
        },
      })),
    }),
    [events],
  );

  const followedData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: followed.map((f) => ({
        type: 'Feature',
        geometry: circlePolygon(f.center, f.radiusM),
        properties: { id: f.id },
      })),
    }),
    [followed],
  );

  return (
    <View style={styles.flex} accessible accessibilityLabel={t('map.mapLabel')}>
      <Map
        style={styles.flex}
        mapStyle={mapStyleFor(scheme === 'dark')}
        attribution
        logo={false}
        touchRotate={false}
        touchPitch={false}
        onRegionDidChange={(e) => onBoundsChange(e.nativeEvent.bounds)}
      >
        <Camera ref={camera} initialViewState={initialView} minZoom={5} maxZoom={17} />
        {boundaries ? (
          <GeoJSONSource id="communes" data={boundaries}>
            <Layer
              id="communes-line"
              type="line"
              paint={{ 'line-color': scheme === 'dark' ? '#3d5566' : '#9fb5a8', 'line-width': 0.8 }}
            />
          </GeoJSONSource>
        ) : null}
        <GeoJSONSource id="followed" data={followedData}>
          <Layer
            id="followed-fill"
            type="fill"
            paint={{ 'fill-color': '#2563EB', 'fill-opacity': 0.08 }}
          />
          <Layer
            id="followed-line"
            type="line"
            paint={{ 'line-color': '#2563EB', 'line-width': 1.5 }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id="events"
          ref={source}
          data={data}
          cluster
          clusterRadius={45}
          clusterMaxZoom={13}
          onPress={async (e) => {
            const feature = e.nativeEvent.features[0];
            if (!feature) return;
            const props = feature.properties as { cluster_id?: number; id?: string } | null;
            if (props?.cluster_id !== undefined && feature.geometry.type === 'Point') {
              const zoom = await source.current?.getClusterExpansionZoom(props.cluster_id);
              const [lng, lat] = feature.geometry.coordinates as [number, number];
              camera.current?.easeTo({ center: [lng, lat], zoom: zoom ?? 12, duration: 500 });
            } else if (props?.id) {
              onSelect(props.id);
            }
          }}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={isCluster}
            paint={{
              'circle-color': '#111111',
              'circle-radius': clusterRadius,
              'circle-stroke-color': '#FFFFFF',
              'circle-stroke-width': 2,
              'circle-opacity': 0.9,
            }}
          />
          <Layer
            id="events-points"
            type="circle"
            filter={isPoint}
            paint={{
              'circle-color': categoryColor,
              'circle-radius': severityRadius,
              'circle-stroke-color': displayStroke,
              'circle-stroke-width': displayStrokeWidth,
              'circle-opacity': displayOpacity,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
