import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { fontSizes, minTouchTarget, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { type PlaceResult, searchPlaces } from '@/lib/data';
import { Muted, TextField } from './ui';

/**
 * Recherche de village, commune ou wilaya (insensible aux accents et aux graphies kabyles,
 * traitement côté base : pg_trgm + unaccent).
 */
export function PlaceSearch({
  label,
  placeholder,
  onSelect,
  excludeWilayas = false,
}: {
  label: string;
  placeholder: string;
  onSelect: (place: PlaceResult) => void;
  excludeWilayas?: boolean;
}) {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searched, setSearched] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then((list) => {
          setResults(excludeWilayas ? list.filter((r) => r.kind !== 'wilaya') : list);
          setSearched(q);
        })
        .catch(() => {
          setResults([]);
          setSearched(q);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, excludeWilayas]);

  const active = query.trim().length >= 2;
  const visible = active ? results : [];

  return (
    <View style={styles.container}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        help={active ? undefined : t('mobile.placeSearchHint')}
      />
      {active && searched === query.trim() && visible.length === 0 ? (
        <Muted>{t('map.noResults')}</Muted>
      ) : null}
      {visible.map((r) => {
        const name = locale === 'ar' && r.name_ar ? r.name_ar : r.name_fr;
        const typeLabel =
          r.kind === 'wilaya' ? t('event.wilaya') : tk(`villages.placeType.${r.kind}`);
        const detail = [
          typeLabel,
          r.kind === 'village' ? r.commune_name_fr : null,
          r.wilaya_name_fr,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={`${r.kind}-${r.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${detail}`}
            onPress={() => {
              onSelect(r);
              setQuery('');
              setResults([]);
            }}
            style={({ pressed }) => [
              styles.result,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              },
            ]}
          >
            <MapPin size={18} color={colors.accent} />
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
              <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  flex: { flex: 1 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: minTouchTarget,
  },
  name: { fontSize: fontSizes.md, fontWeight: '600' },
  detail: { fontSize: fontSizes.sm },
});
