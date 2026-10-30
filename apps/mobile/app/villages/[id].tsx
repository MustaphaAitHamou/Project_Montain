import { useCallback, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { type CategoryId, isCategoryId, isSeverity } from '@tamurt/shared';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { type FollowedPlaceSummary, fetchEventsNear, fetchFollowedPlaces } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Card, Screen } from '@/components/Screen';
import { Button, ErrorText, Loading, Muted, Subtitle } from '@/components/ui';
import { EventCard } from '@/components/EventCard';
import { PlaceSettings, type PlaceSettingsValue } from '@/components/villages/PlaceSettings';

function toSettings(p: FollowedPlaceSummary): PlaceSettingsValue {
  return {
    label: p.label,
    radiusM: p.radius_m,
    categories: (p.categories ?? []).filter((c): c is CategoryId => isCategoryId(c)),
    notify: p.notify,
    minSeverity: p.min_severity && isSeverity(p.min_severity) ? p.min_severity : null,
  };
}

export default function FollowedPlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { userId } = useAuth();
  const fetcher = useCallback(
    () => (userId ? fetchFollowedPlaces() : Promise.resolve([])),
    [userId],
  );
  const places = useRemote(userId ? `private.followed.${userId}` : null, fetcher);
  const place = (places.data ?? []).find((p) => p.id === id) ?? null;

  if (places.loading && !places.data) {
    return (
      <Screen>
        <Loading label={t('common.loading')} />
      </Screen>
    );
  }
  if (!place) {
    return (
      <Screen>
        <Muted>{t('event.notFound')}</Muted>
      </Screen>
    );
  }
  return <PlaceDetail key={place.id} place={place} onSaved={() => void places.refresh()} />;
}

function PlaceDetail({ place, onSaved }: { place: FollowedPlaceSummary; onSaved: () => void }) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const [settings, setSettings] = useState<PlaceSettingsValue>(() => toSettings(place));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const historyFetcher = useCallback(
    () =>
      fetchEventsNear({ lat: place.lat, lng: place.lng }, place.radius_m, place.categories ?? []),
    [place.lat, place.lng, place.radius_m, place.categories],
  );
  const history = useRemote(`private.place.${place.id}.history`, historyFetcher);

  const save = async () => {
    if (!supabase || !userId || !settings.label.trim()) return;
    setState('saving');
    const { error } = await supabase
      .from('user_followed_places')
      .update({
        label: settings.label.trim(),
        radius_m: settings.radiusM,
        categories: settings.categories,
        notify: settings.notify,
        min_severity: settings.minSeverity,
      })
      .eq('id', place.id)
      .eq('user_id', userId);
    setState(error ? 'error' : 'saved');
    if (!error) onSaved();
  };

  return (
    <Screen onRefresh={() => void history.refresh()} refreshing={history.refreshing}>
      <Stack.Screen options={{ title: place.label }} />
      <Card>
        <PlaceSettings
          value={settings}
          onChange={(v) => {
            setSettings(v);
            setState('idle');
          }}
        />
        {state === 'saved' ? <Muted>{t('common.saved')}</Muted> : null}
        {state === 'error' ? <ErrorText>{t('common.errorGeneric')}</ErrorText> : null}
        <Button
          label={t('common.save')}
          loading={state === 'saving'}
          disabled={!settings.label.trim()}
          onPress={() => void save()}
        />
      </Card>
      <Subtitle>{t('villages.history')}</Subtitle>
      {history.loading && !history.data ? <Loading label={t('common.loading')} /> : null}
      {history.data && history.data.length === 0 ? (
        <Muted>{t('villages.noActiveAlerts')}</Muted>
      ) : null}
      {(history.data ?? []).map((e) => (
        <EventCard key={e.id} event={e} now={now} />
      ))}
    </Screen>
  );
}
