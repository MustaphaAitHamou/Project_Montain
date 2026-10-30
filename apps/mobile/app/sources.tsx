import { useCallback } from 'react';
import { Text } from 'react-native';
import { formatDateTime } from '@tamurt/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchSources } from '@/lib/data';
import { Card, Screen } from '@/components/Screen';
import { Loading, Muted } from '@/components/ui';
import { DataStatusBanner } from '@/components/Banners';

/** Sources de données intégrées, leur état et leur attribution (licences). */
export default function SourcesScreen() {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const now = useNow();
  const fetcher = useCallback(() => fetchSources(), []);
  const sources = useRemote('sources', fetcher);
  return (
    <Screen onRefresh={() => void sources.refresh()} refreshing={sources.refreshing}>
      <DataStatusBanner
        savedAt={sources.savedAt}
        fromCache={sources.fromCache}
        error={sources.error}
        now={now}
      />
      {sources.loading && !sources.data ? <Loading label={t('common.loading')} /> : null}
      {(sources.data ?? []).map((s) => (
        <Card key={s.id}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{s.name}</Text>
          <Muted>{tk(`sourceKind.${s.kind}`)}</Muted>
          <Text style={{ color: colors.text }}>
            {s.enabled ? t('admin.enabled') : t('admin.disabled')}
          </Text>
          <Muted>
            {t('admin.lastSuccess')} :{' '}
            {s.last_success_at ? formatDateTime(s.last_success_at, locale) : t('common.never')}
          </Muted>
          {s.attribution ? <Muted>{s.attribution}</Muted> : null}
        </Card>
      ))}
      <Muted>{t('home.vigilanceNone')}</Muted>
    </Screen>
  );
}
