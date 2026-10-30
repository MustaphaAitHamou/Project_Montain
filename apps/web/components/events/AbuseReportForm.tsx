'use client';

import { useActionState, useMemo } from 'react';
import { ABUSE_REASONS } from '@tamurt/shared';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { reportAbuseAction } from '@/app/actions/community';
import { errorMessageKey } from '@/lib/errors';

export function AbuseReportForm({
  targetType,
  targetId,
  locale,
}: {
  targetType: 'event' | 'assistance';
  targetId: string;
  locale: Locale;
}) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(reportAbuseAction, null);
  if (state?.ok) {
    return (
      <p className="banner banner-success" role="status">
        {t('common.saved')}
      </p>
    );
  }
  return (
    <details className="card">
      <summary>{t('event.reportAbuse')}</summary>
      <form action={action} className="stack-sm" style={{ marginBlockStart: 12 }}>
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <div className="field">
          <label htmlFor="abuse-reason">{t('admin.reason')}</label>
          <select id="abuse-reason" name="reason" className="select" required>
            {ABUSE_REASONS.map((r) => (
              <option key={r} value={r}>
                {tk(`abuseReason.${r}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="abuse-details">
            {t('common.details')} ({t('common.optional')})
          </label>
          <textarea id="abuse-details" name="details" className="textarea" maxLength={500} />
        </div>
        {state?.error && (
          <p className="error" role="alert">
            {tk(errorMessageKey(state.error))}
          </p>
        )}
        <button type="submit" className="btn btn-outline" disabled={pending}>
          {t('common.submit')}
        </button>
      </form>
    </details>
  );
}
