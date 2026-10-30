import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { appealSchema, errorMessageKey, formatDateTime, rpcErrorCode } from '@tamurt/shared';
import { fontSizes } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNow } from '@/lib/useNow';
import { useRemote } from '@/lib/useRemote';
import { fetchMyReports } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { Card, Screen } from '@/components/Screen';
import { Button, ErrorText, Loading, Muted, TextField } from '@/components/ui';
import { DataStatusBanner, QueueBanner } from '@/components/Banners';

function AppealForm({ reportId, onDone }: { reportId: string; onDone: () => void }) {
  const { t, tk } = useI18n();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const send = async () => {
    const parsed = appealSchema.safeParse({ reportId, message });
    if (!parsed.success || !supabase) {
      setError('validation.description_too_short');
      return;
    }
    setSending(true);
    const { error: rpcError } = await supabase.rpc('create_appeal', {
      p_report_id: reportId,
      p_message: parsed.data.message,
    });
    setSending(false);
    if (rpcError) setError(errorMessageKey(rpcErrorCode(rpcError)));
    else onDone();
  };
  return (
    <>
      <TextField
        label={t('report.appeal')}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
      />
      {error ? <ErrorText>{tk(error)}</ErrorText> : null}
      <Button
        variant="outline"
        label={t('common.submit')}
        loading={sending}
        onPress={() => void send()}
      />
    </>
  );
}

export default function MyReportsScreen() {
  const { colors } = useTheme();
  const { t, tk, locale } = useI18n();
  const { userId } = useAuth();
  const now = useNow();
  const fetcher = useCallback(
    () => (userId ? fetchMyReports(userId) : Promise.resolve([])),
    [userId],
  );
  const reports = useRemote(userId ? `private.reports.${userId}` : null, fetcher);
  const [appealOpen, setAppealOpen] = useState<string | null>(null);
  const [appealed, setAppealed] = useState<string[]>([]);

  if (!userId) {
    return (
      <Screen>
        <Muted>{t('mobile.signInToReport')}</Muted>
        <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
      </Screen>
    );
  }

  const withdraw = (id: string) =>
    Alert.alert(t('report.withdraw'), t('report.withdrawConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('report.withdraw'),
        style: 'destructive',
        onPress: () => {
          void supabase?.rpc('withdraw_report', { p_report_id: id }).then(() => reports.refresh());
        },
      },
    ]);

  const list = reports.data ?? [];
  return (
    <Screen onRefresh={() => void reports.refresh()} refreshing={reports.refreshing}>
      <DataStatusBanner
        savedAt={reports.savedAt}
        fromCache={reports.fromCache}
        error={reports.error}
        now={now}
      />
      <QueueBanner />
      {reports.loading && !reports.data ? <Loading label={t('common.loading')} /> : null}
      {reports.data && list.length === 0 ? <Muted>{t('report.myReportsEmpty')}</Muted> : null}
      {list.map((r) => (
        <Card key={r.id}>
          <Text style={[styles.title, { color: colors.text }]}>
            {tk(`subcategory.${r.subcategory_id}`)}
          </Text>
          <Muted>{formatDateTime(r.created_at, locale)}</Muted>
          <Text style={{ color: colors.text }}>{r.description}</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {tk(`moderationStatus.${r.moderation_status}`)}
          </Text>
          {r.moderation_status === 'rejected' && r.rejection_reason ? (
            <Muted>
              {t('report.rejectionReason', { reason: tk(`rejectionReason.${r.rejection_reason}`) })}
            </Muted>
          ) : null}
          {r.event_id ? (
            <Button
              variant="ghost"
              label={t('common.details')}
              onPress={() =>
                router.push({ pathname: '/alerte/[id]', params: { id: r.event_id as string } })
              }
            />
          ) : null}
          {r.moderation_status === 'pending' ? (
            <Button variant="outline" label={t('report.withdraw')} onPress={() => withdraw(r.id)} />
          ) : null}
          {r.moderation_status === 'rejected' && !appealed.includes(r.id) ? (
            appealOpen === r.id ? (
              <AppealForm
                reportId={r.id}
                onDone={() => {
                  setAppealed((a) => [...a, r.id]);
                  setAppealOpen(null);
                }}
              />
            ) : (
              <Button
                variant="ghost"
                label={t('report.appeal')}
                onPress={() => setAppealOpen(r.id)}
              />
            )
          ) : null}
          {appealed.includes(r.id) ? <Muted>{t('report.appealSent')}</Muted> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ title: { fontSize: fontSizes.md, fontWeight: '700' } });
