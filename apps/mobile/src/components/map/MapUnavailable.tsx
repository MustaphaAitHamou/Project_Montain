import { MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';

export function MapUnavailable() {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
      <MapPin size={22} color={colors.textMuted} />
      <View style={styles.flex}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('mobile.mapUnavailableTitle')}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t('mobile.mapUnavailableBody')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  flex: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSizes.md, fontWeight: '700' },
  body: { fontSize: fontSizes.sm, lineHeight: 20 },
});
