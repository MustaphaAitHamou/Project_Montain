'use client';

import { useActionState, useMemo } from 'react';
import { LOCALES, LOCALE_INFO, getTranslator, type Locale } from '@tamurt/shared/i18n';
import { SEVERITIES, type Severity } from '@tamurt/shared';
import {
  deleteAccountAction,
  updateNotificationPreferencesAction,
  updateProfileAction,
} from '@/app/actions/account';
import { appealAction } from '@/app/actions/community';
import { errorMessageKey } from '@/lib/errors';

function Result({
  ok,
  messageKey,
  tk,
}: {
  ok?: boolean;
  messageKey?: string;
  tk: (k: string) => string;
}) {
  if (!messageKey) return null;
  return (
    <p
      className={ok ? 'banner banner-success' : 'banner banner-danger'}
      role={ok ? 'status' : 'alert'}
    >
      {tk(messageKey)}
    </p>
  );
}

export function ProfileForm({
  locale,
  displayName,
  preferredLocale,
}: {
  locale: Locale;
  displayName: string | null;
  preferredLocale: Locale;
}) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="stack-sm">
      <div className="field">
        <label htmlFor="displayName">{t('profile.displayName')}</label>
        <input
          id="displayName"
          name="displayName"
          className="input"
          maxLength={40}
          defaultValue={displayName ?? ''}
        />
      </div>
      <div className="field">
        <label htmlFor="preferredLocale">{t('profile.language')}</label>
        <select
          id="preferredLocale"
          name="preferredLocale"
          className="select"
          defaultValue={preferredLocale}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_INFO[code].nativeName}
            </option>
          ))}
        </select>
      </div>
      <Result ok={state?.ok} messageKey={state?.messageKey} tk={tk} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {t('common.save')}
      </button>
    </form>
  );
}

export interface PreferencesValues {
  push_enabled: boolean;
  web_push_enabled: boolean;
  min_severity: Severity;
  include_unverified: boolean;
  updates_enabled: boolean;
  resolution_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

export function NotificationPreferencesForm({
  locale,
  values,
}: {
  locale: Locale;
  values: PreferencesValues;
}) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(updateNotificationPreferencesAction, null);
  const hhmm = (v: string) => v.slice(0, 5);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="timezone" value={values.timezone} />
      <label className="checkbox-row">
        <input type="checkbox" name="pushEnabled" defaultChecked={values.push_enabled} />
        {t('notifications.pushEnabled')}
      </label>
      <label className="checkbox-row">
        <input type="checkbox" name="webPushEnabled" defaultChecked={values.web_push_enabled} />
        {t('notifications.webPushEnabled')}
      </label>
      <div className="field">
        <label htmlFor="minSeverity">{t('notifications.minSeverity')}</label>
        <select
          id="minSeverity"
          name="minSeverity"
          className="select"
          defaultValue={values.min_severity}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {tk(`severity.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          name="includeUnverified"
          defaultChecked={values.include_unverified}
          aria-describedby="unverified-help"
        />
        <span>
          {t('notifications.includeUnverified')}
          <span id="unverified-help" className="hint" style={{ display: 'block' }}>
            {t('notifications.includeUnverifiedHelp')}
          </span>
        </span>
      </label>
      <label className="checkbox-row">
        <input type="checkbox" name="updatesEnabled" defaultChecked={values.updates_enabled} />
        {t('notifications.updates')}
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          name="resolutionEnabled"
          defaultChecked={values.resolution_enabled}
        />
        {t('notifications.resolution')}
      </label>
      <fieldset className="stack-sm">
        <legend>{t('notifications.quietHours')}</legend>
        <p className="hint">{t('notifications.quietHoursHelp')}</p>
        <label className="checkbox-row">
          <input
            type="checkbox"
            name="quietHoursEnabled"
            defaultChecked={values.quiet_hours_enabled}
          />
          {t('notifications.quietHours')}
        </label>
        <div className="row">
          <label htmlFor="quietHoursStart">{t('notifications.quietFrom')}</label>
          <input
            id="quietHoursStart"
            name="quietHoursStart"
            type="time"
            className="input"
            style={{ width: 'auto' }}
            defaultValue={hhmm(values.quiet_hours_start)}
          />
          <label htmlFor="quietHoursEnd">{t('notifications.quietTo')}</label>
          <input
            id="quietHoursEnd"
            name="quietHoursEnd"
            type="time"
            className="input"
            style={{ width: 'auto' }}
            defaultValue={hhmm(values.quiet_hours_end)}
          />
        </div>
      </fieldset>
      <Result ok={state?.ok} messageKey={state?.messageKey} tk={tk} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {t('common.save')}
      </button>
    </form>
  );
}

export function DeleteAccountForm({ locale }: { locale: Locale }) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(deleteAccountAction, null);
  return (
    <details className="card">
      <summary style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
        {t('profile.deleteAccount')}
      </summary>
      <form action={action} className="stack-sm" style={{ marginBlockStart: 12 }}>
        <p className="small">{t('profile.deleteWarning')}</p>
        <div className="field">
          <label htmlFor="confirmWord">{t('profile.deleteConfirmLabel')}</label>
          <input
            id="confirmWord"
            name="confirmWord"
            className="input"
            autoComplete="off"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="delete-password">{t('auth.password')}</label>
          <input
            id="delete-password"
            name="password"
            type="password"
            className="input"
            autoComplete="current-password"
            required
          />
        </div>
        <Result ok={state?.ok} messageKey={state?.messageKey} tk={tk} />
        <button type="submit" className="btn btn-danger" disabled={pending}>
          {t('profile.deleteAccount')}
        </button>
      </form>
    </details>
  );
}

export function AppealForm({ locale, reportId }: { locale: Locale; reportId: string }) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(appealAction, null);
  if (state?.ok) return <p className="banner banner-success">{t('report.appealSent')}</p>;
  return (
    <details>
      <summary className="small">{t('report.appeal')}</summary>
      <form action={action} className="stack-sm" style={{ marginBlockStart: 8 }}>
        <input type="hidden" name="reportId" value={reportId} />
        <textarea
          name="message"
          className="textarea"
          minLength={10}
          maxLength={1000}
          required
          aria-label={t('report.appeal')}
        />
        {state && !state.ok && (
          <p className="error" role="alert">
            {tk(errorMessageKey(state.error))}
          </p>
        )}
        <button type="submit" className="btn btn-sm btn-outline" disabled={pending}>
          {t('common.submit')}
        </button>
      </form>
    </details>
  );
}
