import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatDateTime, isSeverity } from '@tamurt/shared';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchNotifications } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/Screen';
import { Button, Loading, Muted } from '@/components/ui';
import { DataStatusBanner } from '@/components/Banners';
import { SeverityBadge } from '@/components/Badges';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const fetcher = useCallback(
    () => (userId ? fetchNotifications() : Promise.resolve([])),
    [userId],
  );
  const inbox = useRemote(userId ? `private.inbox.${userId}` : null, fetcher);

  if (!userId) {
    return (
      <Screen>
        <Muted>{t('mobile.signInToNotifications')}</Muted>
        <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
      </Screen>
    );
  }

  const items = inbox.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const markAll = async () => {
    await supabase?.rpc('mark_notifications_read', {});
    void inbox.refresh();
  };

  return (
    <Screen onRefresh={() => void inbox.refresh()} refreshing={inbox.refreshing}>
      <Muted>{t('notifications.notOfficial')}</Muted>
      <DataStatusBanner
        savedAt={inbox.savedAt}
        fromCache={inbox.fromCache}
        error={inbox.error}
        now={now}
      />
      <Button
        variant="outline"
        label={t('notifications.preferences')}
        onPress={() => router.push('/notifications/preferences')}
      />
      {unread > 0 ? (
        <Button
          variant="ghost"
          label={`${t('notifications.markAllRead')} (${t('notifications.unread', { count: unread })})`}
          onPress={() => void markAll()}
        />
      ) : null}
      {inbox.loading && !inbox.data ? <Loading label={t('common.loading')} /> : null}
      {inbox.data && items.length === 0 ? <Muted>{t('notifications.inboxEmpty')}</Muted> : null}
      {items.map((n) => {
        const reportReason = (n.data as { reason?: string } | null)?.reason;
        const body =
          n.kind === 'moderation' && reportReason
            ? `${t('moderationStatus.rejected')} — ${tk(`rejectionReason.${reportReason}`)}`
            : n.body;
        const target = n.event_id
          ? () => router.push({ pathname: '/alerte/[id]', params: { id: n.event_id as string } })
          : n.kind === 'moderation'
            ? () => router.push('/signalements')
            : undefined;
        return (
          <Pressable
            key={n.id}
            accessibilityRole={target ? 'link' : 'text'}
            accessibilityLabel={`${n.read_at ? '' : '● '}${n.title}. ${body}`}
            disabled={!target}
            onPress={target}
            style={[
              styles.item,
              {
                backgroundColor: colors.surface,
                borderColor: n.read_at ? colors.border : colors.accent,
              },
            ]}
          >
            <View style={styles.row}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text, fontWeight: n.read_at ? '500' : '800' },
                ]}
              >
                {n.title}
              </Text>
              {n.severity && isSeverity(n.severity) ? (
                <SeverityBadge severity={n.severity} />
              ) : null}
            </View>
            <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
            <Muted>
              {formatDateTime(n.created_at, locale)}
              {!n.read_at ? ' · ●' : ''}
            </Muted>
          </Pressable>
        );
      })}
      <Muted>{t('notifications.deliveryDisclaimer')}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: fontSizes.md, flexShrink: 1 },
  body: { fontSize: fontSizes.sm, lineHeight: 20 },
});
