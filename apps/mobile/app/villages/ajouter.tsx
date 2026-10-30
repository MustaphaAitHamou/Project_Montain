import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { LIMITS, WATCH_RADIUS_DEFAULT_M, errorMessageKey, type LatLng } from '@tamurt/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { type PlaceResult } from '@/lib/data';
import { createFollowedPlace } from '@/lib/followedPlaces';
import { supabase } from '@/lib/supabase';
import { Card, Screen } from '@/components/Screen';
import { Button, Checkbox, Chip, ErrorText, Muted, Row } from '@/components/ui';
import { PlaceSearch } from '@/components/PlaceSearch';
import { LocationField } from '@/components/LocationField';
import { PlaceSettings, type PlaceSettingsValue } from '@/components/villages/PlaceSettings';

export default function AddPlaceScreen() {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [settings, setSettings] = useState<PlaceSettingsValue>({
    label: '',
    radiusM: WATCH_RADIUS_DEFAULT_M,
    categories: [],
    notify: true,
    minSeverity: null,
  });
  const [proposeVillage, setProposeVillage] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId) {
    return (
      <Screen>
        <Muted>{t('villages.signInToSync')}</Muted>
        <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
      </Screen>
    );
  }

  const placeName = (r: PlaceResult) => (locale === 'ar' && r.name_ar ? r.name_ar : r.name_fr);
  const ready = mode === 'search' ? Boolean(selected) : Boolean(point && settings.label.trim());

  const save = async () => {
    setError(null);
    setPending(true);
    const base = {
      radiusM: settings.radiusM,
      categories: settings.categories,
      notify: settings.notify,
      minSeverity: settings.minSeverity,
    };
    const input =
      mode === 'search' && selected
        ? {
            ...base,
            label: (settings.label.trim() || placeName(selected)).slice(0, 60),
            placeType: selected.kind,
            communeCode: selected.kind === 'commune' ? selected.id : null,
            villageId: selected.kind === 'village' ? selected.id : null,
            location: { lat: selected.lat, lng: selected.lng },
          }
        : { ...base, label: settings.label.trim(), placeType: 'custom', location: point };
    const result = await createFollowedPlace(userId, input);
    if (result.ok && mode === 'custom' && proposeVillage && point) {
      // Proposition au référentiel : invisible des autres tant qu'elle n'est pas validée.
      await supabase?.rpc('propose_village', {
        p_name: settings.label.trim(),
        p_lat: point.lat,
        p_lng: point.lng,
      });
    }
    setPending(false);
    if (!result.ok) {
      setError(errorMessageKey(result.error));
      return;
    }
    router.replace({ pathname: '/villages/[id]', params: { id: result.id } });
  };

  return (
    <Screen>
      <Muted>{t('villages.intro')}</Muted>
      <Row>
        <Chip
          label={t('villages.searchPlaceholder')}
          selected={mode === 'search'}
          onPress={() => setMode('search')}
        />
        <Chip
          label={t('villages.customPlace')}
          selected={mode === 'custom'}
          onPress={() => setMode('custom')}
        />
      </Row>
      <Card>
        {mode === 'search' ? (
          selected ? (
            <>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{placeName(selected)}</Text>
              <Muted>
                {tk(`villages.placeType.${selected.kind}`)}
                {selected.wilaya_name_fr ? ` · ${selected.wilaya_name_fr}` : ''}
              </Muted>
              <Button variant="ghost" label={t('common.edit')} onPress={() => setSelected(null)} />
            </>
          ) : (
            <PlaceSearch
              label={t('villages.add')}
              placeholder={t('villages.searchPlaceholder')}
              excludeWilayas
              onSelect={setSelected}
            />
          )
        ) : (
          <>
            <Muted>{t('mobile.customPlaceHelp')}</Muted>
            <LocationField
              value={point}
              uncertaintyM={settings.radiusM}
              onChange={(p) => setPoint(p)}
              mapLabel={t('villages.customPlace')}
            />
            <Checkbox
              label={t('villages.proposeAsVillage')}
              checked={proposeVillage}
              onChange={setProposeVillage}
            />
          </>
        )}
      </Card>
      <Card>
        <PlaceSettings
          value={settings}
          onChange={setSettings}
          labelPlaceholder={selected ? placeName(selected) : undefined}
        />
      </Card>
      {error ? <ErrorText>{tk(error, { max: LIMITS.followedPlacesMax })}</ErrorText> : null}
      <Button
        label={t('common.save')}
        disabled={!ready}
        loading={pending}
        onPress={() => void save()}
      />
    </Screen>
  );
}
