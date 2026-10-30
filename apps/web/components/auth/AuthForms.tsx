'use client';

import { useActionState, useMemo } from 'react';
import Link from 'next/link';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import {
  type AuthState,
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from '@/app/actions/auth';

function useT(locale: Locale) {
  return useMemo(() => getTranslator(locale), [locale]);
}

function FieldError({
  id,
  message,
  tk,
}: {
  id: string;
  message?: string;
  tk: (k: string) => string;
}) {
  if (!message) return null;
  return (
    <p id={id} className="error" role="alert">
      {tk(message)}
    </p>
  );
}

function FormMessage({ state, tk }: { state: AuthState | null; tk: (k: string) => string }) {
  if (!state?.messageKey) return null;
  return (
    <div
      className={state.ok ? 'banner banner-success' : 'banner banner-danger'}
      role={state.ok ? 'status' : 'alert'}
    >
      <p>{tk(state.messageKey)}</p>
    </div>
  );
}

export function SignInForm({ locale, next }: { locale: Locale; next: string }) {
  const { t, tk } = useT(locale);
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} tk={tk} />
      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          aria-invalid={Boolean(state?.fieldErrors?.email)}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" message={state?.fieldErrors?.email} tk={tk} />
      </div>
      <div className="field">
        <label htmlFor="password">{t('auth.password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          aria-invalid={Boolean(state?.fieldErrors?.password)}
          aria-describedby="password-error"
        />
        <FieldError id="password-error" message={state?.fieldErrors?.password} tk={tk} />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? t('common.loading') : t('common.signIn')}
      </button>
      <div className="row-between small">
        <Link href="/mot-de-passe-oublie">{t('auth.forgotPassword')}</Link>
        <Link href={`/inscription${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>
          {t('auth.noAccount')}
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm({ locale }: { locale: Locale }) {
  const { t, tk } = useT(locale);
  const [state, action, pending] = useActionState(signUpAction, null);
  if (state?.ok) return <FormMessage state={state} tk={tk} />;
  return (
    <form action={action} className="stack" noValidate>
      <FormMessage state={state} tk={tk} />
      <p className="small muted">{t('auth.noPhoneRequired')}</p>
      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          aria-invalid={Boolean(state?.fieldErrors?.email)}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" message={state?.fieldErrors?.email} tk={tk} />
      </div>
      <div className="field">
        <label htmlFor="password">{t('auth.password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="input"
          aria-invalid={Boolean(state?.fieldErrors?.password)}
          aria-describedby="password-help password-error"
        />
        <p id="password-help" className="hint">
          {t('auth.passwordHelp')}
        </p>
        <FieldError id="password-error" message={state?.fieldErrors?.password} tk={tk} />
      </div>
      <div className="field">
        <label htmlFor="displayName">{t('auth.displayName')}</label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="nickname"
          maxLength={40}
          className="input"
        />
      </div>
      <label className="checkbox-row">
        <input type="checkbox" name="acceptTerms" required aria-describedby="terms-error" />
        <span>
          {t('auth.acceptTerms')} (<Link href="/conditions">{t('nav.terms')}</Link>,{' '}
          <Link href="/confidentialite">{t('nav.privacy')}</Link>)
        </span>
      </label>
      <FieldError id="terms-error" message={state?.fieldErrors?.acceptTerms} tk={tk} />
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? t('common.loading') : t('common.signUp')}
      </button>
      <Link href="/connexion" className="small">
        {t('auth.haveAccount')}
      </Link>
    </form>
  );
}

export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const { t, tk } = useT(locale);
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  if (state?.ok) return <FormMessage state={state} tk={tk} />;
  return (
    <form action={action} className="stack" noValidate>
      <FormMessage state={state} tk={tk} />
      <div className="field">
        <label htmlFor="email">{t('auth.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          aria-invalid={Boolean(state?.fieldErrors?.email)}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" message={state?.fieldErrors?.email} tk={tk} />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {t('common.submit')}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const { t, tk } = useT(locale);
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="stack">
        <FormMessage state={state} tk={tk} />
        <Link href="/" className="btn btn-primary">
          {t('nav.home')}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="stack" noValidate>
      <FormMessage state={state} tk={tk} />
      <div className="field">
        <label htmlFor="password">{t('auth.newPassword')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="input"
          aria-describedby="password-help password-error"
        />
        <p id="password-help" className="hint">
          {t('auth.passwordHelp')}
        </p>
        <FieldError id="password-error" message={state?.fieldErrors?.password} tk={tk} />
      </div>
      <div className="field">
        <label htmlFor="confirm">{t('auth.confirmPassword')}</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="input"
          aria-describedby="confirm-error"
        />
        <FieldError id="confirm-error" message={state?.fieldErrors?.confirm} tk={tk} />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {t('common.save')}
      </button>
    </form>
  );
}
