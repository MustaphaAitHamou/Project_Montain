import { Suspense, lazy, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Crosshair } from 'lucide-react-native';
import { DEFAULT_REGION, type LatLng, isWithinBBox } from '@tamurt/shared';
import { fontSizes, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { nativeMapAvailable } from '@/lib/mapAvailability';
import { locateOnce } from '@/lib/geolocation';
import { Button, ErrorText, Loading, Muted } from './ui';
import { PlaceSearch } from './PlaceSearch';
import { MapUnavailable } from './map/MapUnavailable';

// Chargé uniquement si le module natif est présent (son import échouerait dans Expo Go).
const LocationPickerNative = lazy(() => import('./map/LocationPickerNative'));

export type LocationSource = 'map' | 'gps' | 'place';

/**
 * Choix d'une position : toucher sur la carte, point de départ GPS (à la demande, non
 * enregistré) ou centre d'un village / d'une commune. Fonctionne aussi sans carte native.
 */
export function LocationField({
  value,
  uncertaintyM,
  onChange,
  mapLabel,
}: {
  value: LatLng | null;
  uncertaintyM: number;
  onChange: (point: LatLng, source: LocationSource, placeName?: string) => void;
  mapLabel: string;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [focusKey, setFocusKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ source: LocationSource; place?: string } | null>(null);

  const set = (point: LatLng, source: LocationSource, place?: string) => {
    onChange(point, source, place);
    setOrigin({ source, place });
    if (source !== 'map') setFocusKey((k) => k + 1);
  };

  const locateMe = async () => {
    setMessage(null);
    setLocating(true);
    const result = await locateOnce();
    setLocating(false);
    if (result.kind === 'denied') setMessage(t('map.locationDenied'));
    else if (result.kind === 'unavailable') setMessage(t('map.locationUnavailable'));
    else if (!isWithinBBox(result.position, DEFAULT_REGION.bbox))
      setMessage(t('report.outsideCoverage'));
    else set(result.position, 'gps');
  };

  return (
    <View style={styles.container}>
      {nativeMapAvailable ? (
        <>
          <Muted>{t('report.tapToPlace')}</Muted>
          <Suspense fallback={<Loading label={t('common.loading')} />}>
            <LocationPickerNative
              value={value}
              uncertaintyM={uncertaintyM}
              focusKey={focusKey}
              onChange={(p) => set(p, 'map')}
              accessibilityLabel={mapLabel}
            />
          </Suspense>
        </>
      ) : (
        <MapUnavailable />
      )}
      <Button
        variant="outline"
        label={locating ? t('map.locating') : t('report.useGps')}
        loading={locating}
        icon={<Crosshair size={18} color={colors.text} />}
        onPress={() => void locateMe()}
      />
      <Muted>{t('report.gpsHint')}</Muted>
      {message ? <ErrorText>{message}</ErrorText> : null}
      <PlaceSearch
        label={t('mobile.pickPlace')}
        placeholder={t('map.searchPlaceholder')}
        excludeWilayas
        onSelect={(p) => set({ lat: p.lat, lng: p.lng }, 'place', p.name_fr)}
      />
      <View accessibilityLiveRegion="polite">
        {value ? (
          <Text style={[styles.coords, { color: colors.text }]}>
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </Text>
        ) : (
          <Muted>{t('mobile.noLocationYet')}</Muted>
        )}
        {origin?.source === 'gps' ? <Muted>{t('mobile.gpsSuggested')}</Muted> : null}
        {origin?.source === 'place' && origin.place ? (
          <Muted>{t('mobile.locationFromPlace', { place: origin.place })}</Muted>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  coords: { fontSize: fontSizes.md, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
