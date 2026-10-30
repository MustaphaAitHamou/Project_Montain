import { useCallback } from 'react';
import { Image, Linking, Share, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ExternalLink, MapPin, Share2 } from 'lucide-react-native';
import {
  eventTitle,
  formatDateTime,
  formatDistance,
  formatUtc,
  isUnverifiedStatus,
  placeLabel,
} from '@tamurt/shared';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchEvent, fetchEventMedia, fetchTimeline, webUrl } from '@/lib/data';
import { Card, Screen } from '@/components/Screen';
import { Button, Loading, Muted, Row, Subtitle } from '@/components/ui';
import { DataStatusBanner, DemoBanner } from '@/components/Banners';
import { CategoryIcon } from '@/components/CategoryIcon';
import { DemoBadge, SeverityBadge, SourceBadge, StatusBadge } from '@/components/Badges';
import { AbuseReportForm } from '@/components/AbuseReportForm';

function Fact({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.body, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const eventFetcher = useCallback(() => fetchEvent(id), [id]);
  const timelineFetcher = useCallback(() => fetchTimeline(id), [id]);
  const mediaFetcher = useCallback(() => fetchEventMedia(id), [id]);
  const event = useRemote(`event.${id}`, eventFetcher);
  const timeline = useRemote(`event.${id}.timeline`, timelineFetcher);
  const media = useRemote(null, mediaFetcher);

  const refresh = () => {
    void event.refresh();
    void timeline.refresh();
    void media.refresh();
  };

  if (event.loading && !event.data) {
    return (
      <Screen>
        <Loading label={t('common.loading')} />
      </Screen>
    );
  }
  const e = event.data;
  if (!e) {
    return (
      <Screen onRefresh={refresh} refreshing={event.refreshing}>
        <DataStatusBanner
          savedAt={event.savedAt}
          fromCache={event.fromCache}
          error={event.error}
          now={now}
        />
        <Muted>{t('event.notFound')}</Muted>
      </Screen>
    );
  }

  const title = eventTitle(e, tk);
  const place = placeLabel(e, locale) || t('common.unknown');
  const share = () =>
    void Share.share({ message: `${title} — ${place}\n${webUrl(`/alertes/${e.id}`)}` }).catch(
      () => undefined,
    );

  return (
    <Screen onRefresh={refresh} refreshing={event.refreshing}>
      <Stack.Screen options={{ title }} />
      <DataStatusBanner
        savedAt={event.savedAt}
        fromCache={event.fromCache}
        error={event.error}
        now={now}
      />
      <View style={styles.header}>
        <CategoryIcon categoryId={e.categoryId} size={30} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Row>
            <MapPin size={16} color={colors.textMuted} />
            <Muted>{place}</Muted>
          </Row>
        </View>
      </View>
      <Row>
        {e.isDemo ? <DemoBadge /> : null}
        <SeverityBadge severity={e.severity} />
        <StatusBadge status={e.status} />
        <SourceBadge sourceKind={e.sourceKind} status={e.status} />
      </Row>

      {e.status === 'resolved' ? <Muted>{t('event.resolvedBanner')}</Muted> : null}
      {isUnverifiedStatus(e.status) ? (
        <View
          accessibilityRole="alert"
          style={[styles.warning, { borderColor: '#F59E0B', backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.body, { color: colors.text }]}>{t('event.unverifiedWarning')}</Text>
        </View>
      ) : null}
      {e.isDemo ? <DemoBanner /> : null}

      <Card>
        <Subtitle>{t('common.details')}</Subtitle>
        <Fact label={t('event.started')} value={formatDateTime(e.startedAt, locale)} />
        <Fact label={t('event.updated')} value={formatDateTime(e.lastActivityAt, locale)} />
        {e.uncertaintyM > 0 ? (
          <Fact
            label={t('event.precision')}
            value={t('event.approxRadius', {
              distance: formatDistance(e.uncertaintyM, locale === 'ar' ? 'ar' : 'fr'),
            })}
          />
        ) : null}
        {e.magnitude !== null ? (
          <>
            <Fact label={t('event.magnitude')} value={`M ${e.magnitude}`} />
            {e.depthKm !== null ? (
              <Fact label={t('event.depth')} value={t('event.depthKm', { depth: e.depthKm })} />
            ) : null}
            <Fact label={t('event.utcTime')} value={formatUtc(e.startedAt)} />
          </>
        ) : null}
        <Fact
          label={t('event.source')}
          value={`${tk(`sourceKind.${e.sourceKind}`)}${e.reportCount > 0 ? ` · ${t('event.reports', { count: e.reportCount })}` : ''}`}
        />
        <Fact label={t('event.coordinates')} value={`${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}`} />
        {e.categoryId === 'earthquake' ? <Muted>{t('event.seismicNoPrediction')}</Muted> : null}
        {e.externalUrl ? (
          <Button
            variant="ghost"
            label={t('event.originLink')}
            icon={<ExternalLink size={16} color={colors.text} />}
            onPress={() => void Linking.openURL(e.externalUrl as string)}
          />
        ) : null}
        <Button
          variant="outline"
          label={t('event.viewOnMap')}
          icon={<MapPin size={16} color={colors.text} />}
          onPress={() =>
            router.push({ pathname: '/carte', params: { lat: String(e.lat), lng: String(e.lng) } })
          }
        />
      </Card>

      {e.publicNote ? (
        <Card>
          <Subtitle>{t('event.publicNote')}</Subtitle>
          <Text style={[styles.body, { color: colors.text }]}>{e.publicNote}</Text>
        </Card>
      ) : null}

      {(media.data ?? []).map((m) =>
        m.url ? (
          <Image
            key={m.id}
            source={{ uri: m.url }}
            style={[
              styles.photo,
              { aspectRatio: m.width && m.height ? m.width / m.height : 4 / 3 },
            ]}
            accessible
            accessibilityLabel={title}
          />
        ) : null,
      )}

      <Card>
        <Subtitle>{t('event.history')}</Subtitle>
        {(timeline.data ?? []).length === 0 ? (
          <Muted>{t('event.timelineEmpty')}</Muted>
        ) : (
          (timeline.data ?? []).map((u) => (
            <View key={u.id} style={styles.timelineItem}>
              <Muted>{formatDateTime(u.created_at, locale)}</Muted>
              <Text style={[styles.body, { color: colors.text }]}>
                {(u.kind === 'created' || u.kind === 'status_change') && u.new_status
                  ? tk(`status.${u.new_status}`)
                  : null}
                {u.kind === 'severity_change' && u.new_severity
                  ? `${t('admin.changeSeverity')} : ${tk(`severity.${u.new_severity}`)}`
                  : null}
                {u.kind === 'note' ? t('event.publicNote') : null}
              </Text>
              {u.message ? <Muted>{u.message}</Muted> : null}
            </View>
          ))
        )}
      </Card>

      <Muted>{t('event.notOfficial')}</Muted>
      <Button
        variant="outline"
        label={t('event.share')}
        icon={<Share2 size={18} color={colors.text} />}
        onPress={share}
      />
      {userId ? <AbuseReportForm targetType="event" targetId={e.id} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  title: { fontSize: fontSizes.xl, fontWeight: '800' },
  body: { fontSize: fontSizes.md, lineHeight: 22 },
  warning: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radii.md, padding: spacing.md },
  fact: { gap: 2 },
  factLabel: { fontSize: fontSizes.sm },
  photo: { width: '100%', borderRadius: radii.md },
  timelineItem: { gap: 2, paddingVertical: spacing.xs },
});
