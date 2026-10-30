import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Megaphone, Plus } from 'lucide-react-native';
import { reportableAlertCategories } from '@tamurt/shared';
import { fontSizes, spacing } from '@tamurt/shared/theme';
import { Card, Screen, Title } from '@/components/Screen';
import { Button, Chip, Loading, Muted, Row, Subtitle } from '@/components/ui';
import {
  DataStatusBanner,
  DemoBanner,
  Disclaimer,
  QueueBanner,
  TranslationNotice,
} from '@/components/Banners';
import { EventCard } from '@/components/EventCard';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchActiveEvents, fetchFollowedPlaces } from '@/lib/data';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const events = useRemote('events.active', fetchActiveEvents);
  const fetchPlaces = useCallback(
    () => (userId ? fetchFollowedPlaces() : Promise.resolve([])),
    [userId],
  );
  const places = useRemote(userId ? `private.followed.${userId}` : null, fetchPlaces);

  const list = events.data ?? [];
  const hasDemo = env.demoMode || list.some((e) => e.isDemo);
  const refresh = () => {
    void events.refresh();
    void places.refresh();
  };

  return (
    <Screen refreshing={events.refreshing} onRefresh={refresh}>
      <Card>
        <Title>{t('app.name')}</Title>
        <Text style={[styles.slogan, { color: colors.textMuted }]}>{t('app.slogan')}</Text>
      </Card>
      <TranslationNotice />
      {hasDemo ? <DemoBanner /> : null}
      <DataStatusBanner
        savedAt={events.savedAt}
        fromCache={events.fromCache}
        error={events.error}
        now={now}
      />
      <QueueBanner />

      <Card>
        <Muted>
          {t('home.zone')} : {t('home.zoneDefault')}
        </Muted>
        {events.loading && !events.data ? (
          <Loading label={t('common.loading')} />
        ) : list.length > 0 ? (
          <Text style={[styles.count, { color: colors.text }]}>
            {t('home.activeCount', { count: list.length })}
          </Text>
        ) : events.data ? (
          <>
            <Text style={[styles.count, { color: colors.text }]}>{t('home.noAlerts')}</Text>
            <Muted>{t('home.noAlertsHint')}</Muted>
          </>
        ) : null}
        <Button
          label={t('home.reportCta')}
          icon={<Megaphone size={18} color={colors.primaryText} />}
          onPress={() => router.push('/signaler')}
        />
      </Card>

      <View style={styles.section}>
        <Subtitle>{t('home.followedTitle')}</Subtitle>
        {!userId ? (
          <Card>
            <Text style={{ color: colors.text }}>{t('villages.signInToSync')}</Text>
            <Button
              variant="outline"
              label={t('common.signIn')}
              onPress={() => router.push('/connexion')}
            />
          </Card>
        ) : (places.data ?? []).length === 0 ? (
          <Card>
            <Text style={{ color: colors.text }}>{t('home.followedEmpty')}</Text>
            <Button
              variant="outline"
              label={t('home.followedEmptyCta')}
              icon={<Plus size={18} color={colors.text} />}
              onPress={() => router.push('/villages/ajouter')}
            />
          </Card>
        ) : (
          (places.data ?? []).map((p) => (
            <Card key={p.id}>
              <Text style={[styles.placeName, { color: colors.text }]}>{p.label}</Text>
              {p.commune_name_fr ? (
                <Muted>
                  {locale === 'ar' && p.commune_name_ar ? p.commune_name_ar : p.commune_name_fr}
                  {p.wilaya_name_fr
                    ? `, ${locale === 'ar' && p.wilaya_name_ar ? p.wilaya_name_ar : p.wilaya_name_fr}`
                    : ''}
                </Muted>
              ) : null}
              <Text style={{ color: p.active_events > 0 ? colors.danger : colors.text }}>
                {p.active_events > 0
                  ? t('villages.activeAlerts', { count: p.active_events })
                  : t('villages.noActiveAlerts')}
              </Text>
              <Button
                variant="ghost"
                label={t('villages.view')}
                onPress={() => router.push({ pathname: '/villages/[id]', params: { id: p.id } })}
              />
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Subtitle>{t('home.latestTitle')}</Subtitle>
        {list.slice(0, 5).map((e) => (
          <EventCard key={e.id} event={e} now={now} />
        ))}
        {list.length > 5 ? (
          <Button
            variant="outline"
            label={t('common.seeAll')}
            onPress={() => router.push('/alertes')}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Subtitle>{t('home.quickCategories')}</Subtitle>
        <Row>
          {reportableAlertCategories().map((c) => (
            <Chip
              key={c.id}
              label={tk(`category.${c.id}`)}
              selected={false}
              onPress={() => router.push({ pathname: '/alertes', params: { category: c.id } })}
            />
          ))}
        </Row>
      </View>

      <Card>
        <Subtitle>{t('home.vigilanceTitle')}</Subtitle>
        <Muted>{t('home.vigilanceNone')}</Muted>
      </Card>
      <Button
        variant="outline"
        label={t('home.sourcesTitle')}
        onPress={() => router.push('/sources')}
      />
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slogan: { fontSize: fontSizes.md, fontStyle: 'italic' },
  count: { fontSize: fontSizes.lg, fontWeight: '700' },
  section: { gap: spacing.sm },
  placeName: { fontSize: fontSizes.md, fontWeight: '700' },
});
