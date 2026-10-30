import { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { formatDistance } from '@tamurt/shared';
import { fontSizes } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchFollowedPlaces } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Card, Screen } from '@/components/Screen';
import { Button, Loading, Muted } from '@/components/ui';
import { DataStatusBanner } from '@/components/Banners';

export default function VillagesScreen() {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const fetcher = useCallback(
    () => (userId ? fetchFollowedPlaces() : Promise.resolve([])),
    [userId],
  );
  const places = useRemote(userId ? `private.followed.${userId}` : null, fetcher);

  if (!userId) {
    return (
      <Screen>
        <Muted>{t('villages.intro')}</Muted>
        <Card>
          <Text style={{ color: colors.text }}>{t('villages.signInToSync')}</Text>
          <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
        </Card>
      </Screen>
    );
  }

  const remove = (id: string, name: string) =>
    Alert.alert(t('villages.remove'), t('villages.removeConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('villages.remove'),
        style: 'destructive',
        onPress: () => {
          void supabase
            ?.from('user_followed_places')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
            .then(() => places.refresh());
        },
      },
    ]);

  const list = places.data ?? [];
  return (
    <Screen onRefresh={() => void places.refresh()} refreshing={places.refreshing}>
      <Muted>{t('villages.intro')}</Muted>
      <DataStatusBanner
        savedAt={places.savedAt}
        fromCache={places.fromCache}
        error={places.error}
        now={now}
      />
      <Button
        label={t('villages.add')}
        icon={<Plus size={18} color={colors.primaryText} />}
        onPress={() => router.push('/villages/ajouter')}
      />
      {places.loading && !places.data ? <Loading label={t('common.loading')} /> : null}
      {places.data && list.length === 0 ? <Muted>{t('villages.empty')}</Muted> : null}
      {list.map((p) => (
        <Card key={p.id}>
          <Text style={[styles.name, { color: colors.text }]}>{p.label}</Text>
          <Muted>
            {tk(`villages.placeType.${p.place_type}`)}
            {p.commune_name_fr
              ? ` · ${locale === 'ar' && p.commune_name_ar ? p.commune_name_ar : p.commune_name_fr}`
              : ''}
            {' · '}
            {t('villages.radiusValue', {
              distance: formatDistance(p.radius_m, locale === 'ar' ? 'ar' : 'fr'),
            })}
          </Muted>
          <Text style={{ color: p.active_events > 0 ? colors.danger : colors.text }}>
            {p.active_events > 0
              ? t('villages.activeAlerts', { count: p.active_events })
              : t('villages.noActiveAlerts')}
          </Text>
          <View style={styles.actions}>
            <Button
              variant="outline"
              label={t('villages.view')}
              onPress={() => router.push({ pathname: '/villages/[id]', params: { id: p.id } })}
              style={styles.grow}
            />
            <Button
              variant="ghost"
              label={t('villages.remove')}
              onPress={() => remove(p.id, p.label)}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: fontSizes.md, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  grow: { flexGrow: 1 },
});
