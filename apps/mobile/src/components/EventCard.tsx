import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { type EventView, eventTitle, formatRelativeTime, placeLabel } from '@tamurt/shared';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { CategoryIcon } from './CategoryIcon';
import { DemoBadge, SeverityBadge, SourceBadge, StatusBadge } from './Badges';

export function EventCard({ event, now }: { event: EventView; now: number }) {
  const { colors } = useTheme();
  const { tk, locale } = useI18n();
  const title = eventTitle(event, tk);
  const place = placeLabel(event, locale);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${place}, ${tk(`status.${event.status}`)}`}
      onPress={() => router.push({ pathname: '/alerte/[id]', params: { id: event.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <CategoryIcon categoryId={event.categoryId} size={22} />
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {place ? <Text style={[styles.meta, { color: colors.textMuted }]}>{place}</Text> : null}
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
      <View style={styles.badges}>
        {event.isDemo ? <DemoBadge /> : null}
        <SeverityBadge severity={event.severity} />
        <StatusBadge status={event.status} />
        <SourceBadge sourceKind={event.sourceKind} status={event.status} />
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {formatRelativeTime(event.lastActivityAt, locale, new Date(now))}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  title: { fontSize: fontSizes.md, fontWeight: '700' },
  meta: { fontSize: fontSizes.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
