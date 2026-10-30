import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ACTIVE_STATUSES, CATEGORIES, type CategoryId, isCategoryId } from '@tamurt/shared';
import { spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchEvents } from '@/lib/data';
import { Chip, Loading, Muted, Row } from '@/components/ui';
import { DataStatusBanner, QueueBanner } from '@/components/Banners';
import { EventCard } from '@/components/EventCard';

export default function AlertesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const initial = isCategoryId(params.category) ? params.category : null;
  // Remonté quand on arrive depuis un raccourci de catégorie (paramètre différent).
  return <AlertesList key={initial ?? 'all'} initialCategory={initial} />;
}

function AlertesList({ initialCategory }: { initialCategory: CategoryId | null }) {
  const { colors } = useTheme();
  const { t, tk } = useI18n();
  const now = useNow();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [category, setCategory] = useState<CategoryId | null>(initialCategory);

  const fetcher = useCallback(
    () =>
      fetchEvents({
        statuses: tab === 'active' ? ACTIVE_STATUSES : ['resolved', 'archived'],
        categories: category ? [category] : undefined,
        sinceHours: tab === 'history' ? 24 * 90 : undefined,
        limit: 100,
      }),
    [tab, category],
  );
  const events = useRemote(`events.list.${tab}.${category ?? 'all'}`, fetcher);

  const header = (
    <View style={styles.header}>
      <Row>
        <Chip
          label={t('alerts.active')}
          selected={tab === 'active'}
          onPress={() => setTab('active')}
        />
        <Chip
          label={t('alerts.history')}
          selected={tab === 'history'}
          onPress={() => setTab('history')}
        />
      </Row>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('common.all')}
          selected={category === null}
          onPress={() => setCategory(null)}
        />
        {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
          <Chip
            key={c.id}
            label={tk(`category.${c.id}`)}
            selected={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </ScrollView>
      <DataStatusBanner
        savedAt={events.savedAt}
        fromCache={events.fromCache}
        error={events.error}
        now={now}
      />
      <QueueBanner />
      {events.loading && !events.data ? <Loading label={t('common.loading')} /> : null}
      {events.data && events.data.length === 0 ? (
        <Muted>{tab === 'active' && !category ? t('home.noAlerts') : t('alerts.empty')}</Muted>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={events.data ?? []}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => <EventCard event={item} now={now} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListHeaderComponent={header}
      refreshing={events.refreshing}
      onRefresh={() => void events.refresh()}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
});
