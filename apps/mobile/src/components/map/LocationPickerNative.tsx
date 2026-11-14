import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { type LatLng, circlePolygon } from '@tamurt/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { COVERAGE, mapStyleFor } from './mapStyle';

/** Carte de placement : un toucher place le marqueur sur le phénomène (pas sur l'utilisateur). */
export default function LocationPickerNative({
  value,
  uncertaintyM,
  focusKey,
  onChange,
  accessibilityLabel,
}: {
  value: LatLng | null;
  uncertaintyM: number;
  /** Incrémenté quand la valeur est fixée hors de la carte (GPS, recherche) pour recentrer. */
  focusKey: number;
  onChange: (point: LatLng) => void;
  accessibilityLabel: string;
}) {
  const { scheme, colors } = useTheme();
  const camera = useRef<CameraRef>(null);

  useEffect(() => {
    if (value && focusKey > 0)
      camera.current?.flyTo({ center: [value.lng, value.lat], zoom: 13, duration: 600 });
    // Recentrage uniquement sur demande explicite (focusKey), pas à chaque toucher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const data = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: value
        ? [
            {
              type: 'Feature',
              geometry: circlePolygon(value, Math.max(uncertaintyM, 30)),
              properties: { kind: 'area' },
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [value.lng, value.lat] },
              properties: { kind: 'point' },
            },
          ]
        : [],
    }),
    [value, uncertaintyM],
  );

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibilityLabel}>
      <Map
        style={styles.flex}
        mapStyle={mapStyleFor(scheme === 'dark')}
        attribution
        logo={false}
        touchRotate={false}
        touchPitch={false}
        onPress={(e) => {
          const [lng, lat] = e.nativeEvent.lngLat;
          onChange({ lat, lng });
        }}
      >
        <Camera ref={camera} initialViewState={{ bounds: COVERAGE }} minZoom={6} maxZoom={18} />
        <GeoJSONSource id="pick" data={data}>
          <Layer
            id="pick-area"
            type="fill"
            filter={['==', ['get', 'kind'], 'area']}
            paint={{ 'fill-color': '#D9261C', 'fill-opacity': 0.15 }}
          />
          <Layer
            id="pick-point"
            type="circle"
            filter={['==', ['get', 'kind'], 'point']}
            paint={{
              'circle-color': '#D9261C',
              'circle-radius': 9,
              'circle-stroke-color': colors.surface,
              'circle-stroke-width': 3,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 300, borderRadius: 12, overflow: 'hidden' },
  flex: { flex: 1 },
});
