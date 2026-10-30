import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { getCalendars } from 'expo-localization';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  SEVERITIES,
  type NotificationPreferencesInput,
  isSeverity,
  notificationPreferencesSchema,
} from '@tamurt/shared';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { type PushStatus, registerForPush, storedPushToken, unregisterPush } from '@/lib/push';
import { Card, Screen } from '@/components/Screen';
import {
  Button,
  Checkbox,
  Chip,
  ErrorText,
  Loading,
  Muted,
  Row,
  Subtitle,
  TextField,
} from '@/components/ui';

function deviceTimeZone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  }
}

export default function NotificationPreferencesScreen() {
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferencesInput | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void storedPushToken().then((token) => setRegistered(Boolean(token)));
    if (!userId || !supabase) return;
    void supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setPrefs(
          data
            ? {
                pushEnabled: data.push_enabled,
                webPushEnabled: data.web_push_enabled,
                minSeverity: isSeverity(data.min_severity) ? data.min_severity : 'vigilance',
                includeUnverified: data.include_unverified,
                updatesEnabled: data.updates_enabled,
                resolutionEnabled: data.resolution_enabled,
                quietHoursEnabled: data.quiet_hours_enabled,
                quietHoursStart: String(data.quiet_hours_start).slice(0, 5),
                quietHoursEnd: String(data.quiet_hours_end).slice(0, 5),
                timezone: data.timezone,
              }
            : { ...DEFAULT_NOTIFICATION_PREFERENCES, timezone: deviceTimeZone() },
        );
      });
  }, [userId]);

  if (!userId) {
    return (
      <Screen>
        <Muted>{t('mobile.signInToNotifications')}</Muted>
        <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
      </Screen>
    );
  }

  const enablePush = async () => {
    setPushBusy(true);
    const status = await registerForPush(locale);
    setPushStatus(status);
    if (status === 'registered') setRegistered(true);
    setPushBusy(false);
  };
  const disablePush = async () => {
    setPushBusy(true);
    await unregisterPush();
    setRegistered(false);
    setPushStatus(null);
    setPushBusy(false);
  };

  const set = (patch: Partial<NotificationPreferencesInput>) => {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    setState('idle');
  };

  const save = async () => {
    setError(null);
    const parsed = notificationPreferencesSchema.safeParse({
      ...prefs,
      timezone: deviceTimeZone(),
    });
    if (!parsed.success || !supabase) {
      setError(
        parsed.success
          ? 'common.errorGeneric'
          : (parsed.error.issues[0]?.message ?? 'common.errorGeneric'),
      );
      return;
    }
    setState('saving');
    const p = parsed.data;
    const { error: dbError } = await supabase
      .from('notification_preferences')
      .update({
        push_enabled: p.pushEnabled,
        web_push_enabled: p.webPushEnabled,
        min_severity: p.minSeverity,
        include_unverified: p.includeUnverified,
        updates_enabled: p.updatesEnabled,
        resolution_enabled: p.resolutionEnabled,
        quiet_hours_enabled: p.quietHoursEnabled,
        quiet_hours_start: p.quietHoursStart,
        quiet_hours_end: p.quietHoursEnd,
        timezone: p.timezone,
      })
      .eq('user_id', userId);
    if (dbError) {
      setError('common.errorGeneric');
      setState('idle');
    } else {
      setPrefs(p);
      setState('saved');
    }
  };

  const pushMessage: Record<Exclude<PushStatus, 'registered'>, string> = {
    denied: t('notifications.permissionDenied'),
    no_device: t('mobile.pushDeviceRequired'),
    not_configured: t('mobile.pushNotConfigured'),
    error: t('common.errorGeneric'),
  };

  return (
    <Screen>
      <Card>
        <Subtitle>{t('notifications.pushEnabled')}</Subtitle>
        {registered === null ? <Loading label={t('common.loading')} /> : null}
        {registered ? <Muted>{t('mobile.pushRegistered')}</Muted> : null}
        {pushStatus && pushStatus !== 'registered' ? (
          <ErrorText>{pushMessage[pushStatus]}</ErrorText>
        ) : null}
        {pushStatus === 'denied' ? (
          <Button
            variant="ghost"
            label={t('mobile.openSettings')}
            onPress={() => void Linking.openSettings()}
          />
        ) : null}
        {registered ? (
          <Button
            variant="outline"
            label={t('mobile.pushDisable')}
            loading={pushBusy}
            onPress={() => void disablePush()}
          />
        ) : (
          <Button
            label={t('mobile.pushEnable')}
            loading={pushBusy}
            onPress={() => void enablePush()}
          />
        )}
        <Muted>{t('notifications.deliveryDisclaimer')}</Muted>
        <Muted>{t('notifications.notOfficial')}</Muted>
      </Card>

      {!prefs ? (
        <Loading label={t('common.loading')} />
      ) : (
        <Card>
          <Subtitle>{t('notifications.preferences')}</Subtitle>
          <Checkbox
            label={t('notifications.pushEnabled')}
            checked={prefs.pushEnabled}
            onChange={(v) => set({ pushEnabled: v })}
          />
          <Subtitle>{t('notifications.minSeverity')}</Subtitle>
          <Row>
            {SEVERITIES.map((s) => (
              <Chip
                key={s}
                label={tk(`severity.${s}`)}
                selected={prefs.minSeverity === s}
                onPress={() => set({ minSeverity: s })}
              />
            ))}
          </Row>
          <Checkbox
            label={t('notifications.includeUnverified')}
            help={t('notifications.includeUnverifiedHelp')}
            checked={prefs.includeUnverified}
            onChange={(v) => set({ includeUnverified: v })}
          />
          <Checkbox
            label={t('notifications.updates')}
            checked={prefs.updatesEnabled}
            onChange={(v) => set({ updatesEnabled: v })}
          />
          <Checkbox
            label={t('notifications.resolution')}
            checked={prefs.resolutionEnabled}
            onChange={(v) => set({ resolutionEnabled: v })}
          />
          <Checkbox
            label={t('notifications.quietHours')}
            help={t('notifications.quietHoursHelp')}
            checked={prefs.quietHoursEnabled}
            onChange={(v) => set({ quietHoursEnabled: v })}
          />
          {prefs.quietHoursEnabled ? (
            <Row>
              <TextField
                label={t('notifications.quietFrom')}
                value={prefs.quietHoursStart}
                onChangeText={(v) => set({ quietHoursStart: v })}
                placeholder="22:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <TextField
                label={t('notifications.quietTo')}
                value={prefs.quietHoursEnd}
                onChangeText={(v) => set({ quietHoursEnd: v })}
                placeholder="07:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </Row>
          ) : null}
          <Muted>{deviceTimeZone()}</Muted>
          {error ? <ErrorText>{tk(error)}</ErrorText> : null}
          {state === 'saved' ? <Muted>{t('common.saved')}</Muted> : null}
          <Button
            label={t('common.save')}
            loading={state === 'saving'}
            onPress={() => void save()}
          />
        </Card>
      )}
    </Screen>
  );
}
