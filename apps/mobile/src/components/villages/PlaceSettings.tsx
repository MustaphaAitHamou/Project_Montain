import { ScrollView, View } from 'react-native';
import {
  CATEGORIES,
  SEVERITIES,
  WATCH_RADIUS_OPTIONS_M,
  formatDistance,
  type CategoryId,
  type Severity,
} from '@tamurt/shared';
import { spacing } from '@tamurt/shared/theme';
import { useI18n } from '@/lib/i18n';
import { Checkbox, Chip, Muted, Row, Subtitle, TextField } from '@/components/ui';

export interface PlaceSettingsValue {
  label: string;
  radiusM: number;
  categories: CategoryId[];
  notify: boolean;
  minSeverity: Severity | null;
}

/** Réglages d'un lieu suivi : nom, rayon, catégories, notifications, gravité minimale. */
export function PlaceSettings({
  value,
  onChange,
  labelPlaceholder,
}: {
  value: PlaceSettingsValue;
  onChange: (next: PlaceSettingsValue) => void;
  labelPlaceholder?: string;
}) {
  const { t, tk, locale } = useI18n();
  const set = (patch: Partial<PlaceSettingsValue>) => onChange({ ...value, ...patch });
  const toggleCategory = (id: CategoryId) =>
    set({
      categories: value.categories.includes(id)
        ? value.categories.filter((c) => c !== id)
        : [...value.categories, id],
    });

  return (
    <View style={{ gap: spacing.md }}>
      <TextField
        label={t('villages.customLabel')}
        placeholder={labelPlaceholder ?? t('villages.customLabelPlaceholder')}
        value={value.label}
        onChangeText={(label) => set({ label })}
        maxLength={60}
      />
      <Subtitle>{t('villages.radius')}</Subtitle>
      <Row>
        {WATCH_RADIUS_OPTIONS_M.map((r) => (
          <Chip
            key={r}
            label={formatDistance(r, locale === 'ar' ? 'ar' : 'fr')}
            selected={value.radiusM === r}
            onPress={() => set({ radiusM: r })}
          />
        ))}
      </Row>
      <Muted>
        {t('villages.radiusValue', {
          distance: formatDistance(value.radiusM, locale === 'ar' ? 'ar' : 'fr'),
        })}
      </Muted>
      <Subtitle>{t('villages.categories')}</Subtitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        <Chip
          label={t('villages.allCategories')}
          selected={value.categories.length === 0}
          onPress={() => set({ categories: [] })}
        />
        {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
          <Chip
            key={c.id}
            label={tk(`category.${c.id}`)}
            selected={value.categories.includes(c.id)}
            onPress={() => toggleCategory(c.id)}
          />
        ))}
      </ScrollView>
      <Checkbox
        label={t('villages.notify')}
        checked={value.notify}
        onChange={(notify) => set({ notify })}
      />
      <Subtitle>{t('villages.minSeverity')}</Subtitle>
      <Row>
        <Chip
          label={t('villages.useGlobal')}
          selected={value.minSeverity === null}
          onPress={() => set({ minSeverity: null })}
        />
        {SEVERITIES.map((s) => (
          <Chip
            key={s}
            label={tk(`severity.${s}`)}
            selected={value.minSeverity === s}
            onPress={() => set({ minSeverity: s })}
          />
        ))}
      </Row>
    </View>
  );
}
