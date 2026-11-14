import { CloudUpload, Info, WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { assessFreshness, formatDateTime } from '@tamurt/shared';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { isBackendConfigured } from '@/lib/env';
import { useOnline } from '@/lib/connectivity';
import { useQueuedReports } from '@/lib/offlineQueue';

function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'info' | 'warning' | 'danger';
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const border = { info: colors.info, warning: '#F8BA3C', danger: colors.danger }[tone];
  return (
    <View
      accessibilityRole={tone === 'info' ? 'text' : 'alert'}
      style={[styles.notice, { borderColor: border, backgroundColor: colors.surfaceAlt }]}
    >
      {icon}
      <Text style={[styles.text, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

/**
 * État des données affichées : hors connexion, serveur injoignable, données anciennes.
 * Les données en cache ne sont jamais présentées comme à jour.
 */
export function DataStatusBanner({
  savedAt,
  fromCache,
  error,
  now,
}: {
  savedAt: string | null;
  fromCache: boolean;
  error: boolean;
  now: number;
}) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const online = useOnline();
  if (!isBackendConfigured) return <Notice tone="danger">{t('connectivity.notConfigured')}</Notice>;
  const freshness = assessFreshness(savedAt, new Date(now));
  if (online === false) {
    return (
      <Notice tone="warning" icon={<WifiOff size={18} color={colors.text} />}>
        {t('connectivity.offline')} {t('connectivity.offlineDetail')}
        {savedAt ? ` ${t('connectivity.savedAt', { time: formatDateTime(savedAt, locale) })}` : ''}
      </Notice>
    );
  }
  if (error) {
    return (
      <Notice tone="warning">
        {t('connectivity.backendUnavailable')}
        {fromCache && savedAt
          ? ` ${t('connectivity.savedAt', { time: formatDateTime(savedAt, locale) })}`
          : ''}
      </Notice>
    );
  }
  if (freshness.level === 'stale' || freshness.level === 'aging') {
    return (
      <Notice tone="info">
        {t('connectivity.staleData', { minutes: freshness.ageMinutes ?? 0 })}
      </Notice>
    );
  }
  return null;
}

export function QueueBanner() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const count = useQueuedReports();
  if (count === 0) return null;
  return (
    <Notice tone="info" icon={<CloudUpload size={18} color={colors.text} />}>
      {t('offline.queued', { count })}
    </Notice>
  );
}

export function DemoBanner() {
  const { t } = useI18n();
  return <Notice tone="warning">{t('demo.banner')}</Notice>;
}

/** Avertissement de traduction : kabyle provisoire, arabe non relu. */
export function TranslationNotice() {
  const { t, info } = useI18n();
  const { colors } = useTheme();
  if (info.reviewStatus === 'reference') return null;
  return (
    <Notice tone="info" icon={<Info size={18} color={colors.text} />}>
      {info.reviewStatus === 'provisional'
        ? t('i18n.provisionalNotice')
        : t('i18n.unreviewedNotice')}
    </Notice>
  );
}

export function Disclaimer() {
  const { t } = useI18n();
  return (
    <Notice tone="info">
      {t('app.disclaimerShort')} {t('app.disclaimerEmergency')}
    </Notice>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  text: { flex: 1, fontSize: fontSizes.sm, lineHeight: 20 },
});
