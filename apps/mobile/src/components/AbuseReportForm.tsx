import { useState } from 'react';
import { View } from 'react-native';
import { ABUSE_REASONS, abuseReportSchema, errorMessageKey, rpcErrorCode } from '@tamurt/shared';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Button, ErrorText, Muted, RadioRow, Subtitle, TextField } from './ui';
import { Card } from './Screen';

/** Signalement d'un contenu problématique, traité par l'équipe de modération. */
export function AbuseReportForm({
  targetType,
  targetId,
}: {
  targetType: 'event' | 'report';
  targetId: string;
}) {
  const { t, tk } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof ABUSE_REASONS)[number] | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return <Button variant="ghost" label={t('event.reportAbuse')} onPress={() => setOpen(true)} />;
  if (state === 'sent') return <Muted>{t('common.saved')}</Muted>;

  const send = async () => {
    const parsed = abuseReportSchema.safeParse({
      targetType,
      targetId,
      reason,
      details: details.trim() || undefined,
    });
    if (!parsed.success || !supabase) {
      setError('common.errorGeneric');
      return;
    }
    setState('sending');
    const { error: rpcError } = await supabase.rpc('create_abuse_report', {
      p_target_type: parsed.data.targetType,
      p_target_id: parsed.data.targetId,
      p_reason: parsed.data.reason,
      p_details: parsed.data.details,
    });
    if (rpcError) {
      setError(errorMessageKey(rpcErrorCode(rpcError)));
      setState('idle');
    } else {
      setState('sent');
    }
  };

  return (
    <Card>
      <Subtitle>{t('event.reportAbuse')}</Subtitle>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {ABUSE_REASONS.map((r) => (
          <RadioRow
            key={r}
            label={tk(`abuseReason.${r}`)}
            selected={reason === r}
            onPress={() => setReason(r)}
          />
        ))}
      </View>
      <TextField
        label={`${t('common.details')} (${t('common.optional')})`}
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={500}
      />
      {error ? <ErrorText>{tk(error)}</ErrorText> : null}
      <Button
        label={t('common.submit')}
        disabled={!reason}
        loading={state === 'sending'}
        onPress={() => void send()}
      />
      <Button variant="ghost" label={t('common.cancel')} onPress={() => setOpen(false)} />
    </Card>
  );
}
