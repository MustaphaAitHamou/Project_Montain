import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Crosshair } from 'lucide-react-native';
import {
  type BBox,
  type CategoryId,
  CATEGORIES,
  KABYLIE_REGION,
  isWithinBBox,
} from '@tamurt/shared';
import { fontSizes, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchEventsInBBox, fetchFollowedPlaces } from '@/lib/data';
import { nativeMapAvailable } from '@/lib/mapAvailability';
import { locateOnce } from '@/lib/geolocation';
import { Button, Chip, ErrorText, Loading, Muted, Row } from '@/components/ui';
import { DataStatusBanner } from '@/components/Banners';
import { EventCard } from '@/components/EventCard';
import { PlaceSearch } from '@/components/PlaceSearch';
import { MapUnavailable } from '@/components/map/MapUnavailable';
import type { MapFocus } from '@/components/map/EventMapNative';

// Module natif : chargé uniquement s'il est présent (version compilée, pas Expo Go).
const EventMapNative = lazy(() => import('@/components/map/EventMapNative'));

const PERIODS = [
  { hours: 24, key: 'map.period24h' },
  { hours: 24 * 7, key: 'map.period7d' },
  { hours: 24 * 30, key: 'map.period30d' },
] as const;

export default function CarteScreen() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const initialFocus: MapFocus | null =
    params.lat && params.lng && Number.isFinite(lat) && Number.isFinite(lng)
      ? { center: { lat, lng }, zoom: 13, key: 1 }
      : null;
  // Remonté quand on arrive depuis une fiche (« Voir sur la carte ») avec une autre position.
  return (
    <CarteContent key={`${params.lat ?? ''},${params.lng ?? ''}`} initialFocus={initialFocus} />
  );
}

function CarteContent({ initialFocus }: { initialFocus: MapFocus | null }) {
  const { colors } = useTheme();
  const { t, tk } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [sinceHours, setSinceHours] = useState<number>(24 * 7);
  const [activeOnly, setActiveOnly] = useState(true);
  const [bounds, setBounds] = useState<BBox>(KABYLIE_REGION.bbox);
  const [focus, setFocus] = useState<MapFocus | null>(initialFocus);
  const [locating, setLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);

  // Toute la zone couverte est chargée (PostGIS) puis filtrée sur l'emprise affichée.
  const fetcher = useCallback(
    () => fetchEventsInBBox(KABYLIE_REGION.bbox, { categories, activeOnly, sinceHours }),
    [categories, activeOnly, sinceHours],
  );
  const cacheKey = `events.map.${categories.join(',')}.${activeOnly}.${sinceHours}`;
  const events = useRemote(cacheKey, fetcher);
  const fetchPlaces = useCallback(
    () => (userId ? fetchFollowedPlaces() : Promise.resolve([])),
    [userId],
  );
  const places = useRemote(userId ? `private.followed.${userId}` : null, fetchPlaces);

  const all = useMemo(() => events.data ?? [], [events.data]);
  const inView = useMemo(
    () =>
      nativeMapAvailable
        ? all.filter((e) => isWithinBBox({ lat: e.lat, lng: e.lng }, bounds))
        : all,
    [all, bounds],
  );
  const followed = useMemo(
    () =>
      (places.data ?? []).map((p) => ({
        id: p.id,
        center: { lat: p.lat, lng: p.lng },
        radiusM: p.radius_m,
      })),
    [places.data],
  );

  const toggleCategory = (id: CategoryId) =>
    setCategories((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );

  const locateMe = async () => {
    setLocateMessage(null);
    setLocating(true);
    const result = await locateOnce();
    setLocating(false);
    if (result.kind === 'denied') setLocateMessage(t('map.locationDenied'));
    else if (result.kind === 'unavailable') setLocateMessage(t('map.locationUnavailable'));
    else setFocus((f) => ({ center: result.position, zoom: 12, key: (f?.key ?? 0) + 1 }));
  };

  const header = (
    <View style={styles.header}>
      <PlaceSearch
        label={t('map.searchLabel')}
        placeholder={t('map.searchPlaceholder')}
        onSelect={(p) =>
          setFocus((f) => ({
            center: { lat: p.lat, lng: p.lng },
            zoom: p.kind === 'wilaya' ? 9 : 12,
            key: (f?.key ?? 0) + 1,
          }))
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
          <Chip
            key={c.id}
            label={tk(`category.${c.id}`)}
            selected={categories.includes(c.id)}
            onPress={() => toggleCategory(c.id)}
          />
        ))}
      </ScrollView>
      <Row>
        {PERIODS.map((p) => (
          <Chip
            key={p.hours}
            label={t(p.key)}
            selected={sinceHours === p.hours}
            onPress={() => setSinceHours(p.hours)}
          />
        ))}
        <Chip
          label={activeOnly ? t('map.activeOnly') : t('map.includeResolved')}
          selected={!activeOnly}
          onPress={() => setActiveOnly(!activeOnly)}
        />
      </Row>
      {locateMessage ? <ErrorText>{locateMessage}</ErrorText> : null}
      <DataStatusBanner
        savedAt={events.savedAt}
        fromCache={events.fromCache}
        error={events.error}
        now={now}
      />
      {nativeMapAvailable ? null : <MapUnavailable />}
      <Muted>{t('map.attribution')}</Muted>
      <Muted>{t('map.hotspotDisclaimer')}</Muted>
      <Text accessibilityLiveRegion="polite" style={[styles.count, { color: colors.text }]}>
        {t('map.eventsInView', { count: inView.length })}
      </Text>
      {events.loading && !events.data ? <Loading label={t('common.loading')} /> : null}
      {events.data && inView.length === 0 ? <Muted>{t('alerts.empty')}</Muted> : null}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {nativeMapAvailable ? (
        // Carte hors de la liste défilante : pas de conflit entre déplacement de carte et défilement.
        <View style={[styles.mapPane, { borderColor: colors.border }]}>
          <Suspense fallback={<Loading label={t('common.loading')} />}>
            <EventMapNative
              events={all}
              focus={focus}
              followed={followed}
              onBoundsChange={setBounds}
              onSelect={(id) => router.push({ pathname: '/alerte/[id]', params: { id } })}
            />
          </Suspense>
          <View style={styles.overlay}>
            <Button
              variant="primary"
              label={locating ? t('map.locating') : t('map.locateMe')}
              loading={locating}
              icon={<Crosshair size={18} color={colors.primaryText} />}
              onPress={() => void locateMe()}
            />
          </View>
        </View>
      ) : null}
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={inView}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} now={now} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        keyboardShouldPersistTaps="handled"
        refreshing={events.refreshing}
        onRefresh={() => void events.refresh()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  flex: { flex: 1 },
  mapPane: { height: '45%', borderBottomWidth: 1 },
  overlay: { position: 'absolute', bottom: spacing.md, end: spacing.md },
  count: { fontSize: fontSizes.md, fontWeight: '700' },
});
