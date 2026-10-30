import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import {
  authErrorKey,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
} from '@tamurt/shared';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { webUrl } from '@/lib/data';
import { flushQueue } from '@/lib/offlineQueue';
import { Button, Checkbox, ErrorText, Muted, TextField } from './ui';
import { Card } from './Screen';

type Mode = 'signIn' | 'signUp' | 'reset';

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0] ?? 'form')] ??= issue.message;
  return out;
}

/**
 * Authentification par e-mail (aucun numéro de téléphone). Les liens de confirmation et de
 * réinitialisation ouvrent le site web, qui vérifie le jeton ; l'utilisateur se connecte
 * ensuite dans l'application.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const { t, tk, locale } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ key: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setErrors({});
    setMessage(null);
    if (!supabase) {
      setMessage({ key: 'connectivity.notConfigured', ok: false });
      return;
    }
    setPending(true);
    try {
      if (mode === 'signIn') {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) return setMessage({ key: authErrorKey(error.code, error.status), ok: false });
        void flushQueue();
        if (router.canGoBack()) router.back();
        else router.replace('/');
      } else if (mode === 'signUp') {
        const parsed = signUpSchema.safeParse({
          email,
          password,
          displayName: displayName || undefined,
          acceptTerms,
        });
        if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: webUrl('/auth/confirm'),
            data: { display_name: parsed.data.displayName, preferred_locale: locale },
          },
        });
        if (error) return setMessage({ key: authErrorKey(error.code, error.status), ok: false });
        // Message identique que l'adresse soit connue ou non (pas d'énumération des comptes).
        setMessage({ key: 'auth.checkEmail', ok: true });
      } else {
        const parsed = passwordResetRequestSchema.safeParse({ email });
        if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
          redirectTo: webUrl('/reinitialiser-mot-de-passe'),
        });
        if (error && error.status === 429)
          return setMessage({ key: 'auth.rateLimited', ok: false });
        setMessage({ key: 'auth.resetSent', ok: true });
      }
    } finally {
      setPending(false);
    }
  };

  const submitLabel =
    mode === 'signIn'
      ? t('common.signIn')
      : mode === 'signUp'
        ? t('common.signUp')
        : t('common.submit');

  return (
    <Card>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email ? tk(errors.email) : null}
      />
      {mode !== 'reset' ? (
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          help={mode === 'signUp' ? t('auth.passwordHelp') : undefined}
          error={errors.password ? tk(errors.password) : null}
        />
      ) : null}
      {mode === 'signUp' ? (
        <>
          <TextField
            label={t('auth.displayName')}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={40}
          />
          <Checkbox label={t('auth.acceptTerms')} checked={acceptTerms} onChange={setAcceptTerms} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Button
              variant="ghost"
              label={t('nav.terms')}
              onPress={() => void Linking.openURL(webUrl('/conditions'))}
            />
            <Button
              variant="ghost"
              label={t('nav.privacy')}
              onPress={() => void Linking.openURL(webUrl('/confidentialite'))}
            />
          </View>
          {errors.acceptTerms ? <ErrorText>{tk(errors.acceptTerms)}</ErrorText> : null}
          <Muted>{t('auth.noPhoneRequired')}</Muted>
        </>
      ) : null}
      {message ? (
        message.ok ? (
          <Muted>{tk(message.key)}</Muted>
        ) : (
          <ErrorText>{tk(message.key)}</ErrorText>
        )
      ) : null}
      <Button label={submitLabel} loading={pending} onPress={() => void submit()} />
      {mode === 'signIn' ? (
        <>
          <Button
            variant="ghost"
            label={t('auth.forgotPassword')}
            onPress={() => router.push('/mot-de-passe-oublie')}
          />
          <Button
            variant="ghost"
            label={t('auth.noAccount')}
            onPress={() => router.replace('/inscription')}
          />
        </>
      ) : null}
      {mode === 'signUp' ? (
        <Button
          variant="ghost"
          label={t('auth.haveAccount')}
          onPress={() => router.replace('/connexion')}
        />
      ) : null}
    </Card>
  );
}
