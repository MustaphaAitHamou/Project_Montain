'use client';

import { useActionState, useMemo } from 'react';
import { ASSISTANCE_KINDS } from '@tamurt/shared';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { createAssistanceAction } from '@/app/actions/assistance';
import { errorMessageKey } from '@/lib/errors';

export function AssistanceForm({
  locale,
  communes,
}: {
  locale: Locale;
  communes: { code: string; name: string; wilaya: string }[];
}) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(createAssistanceAction, null);
  if (state?.ok) {
    return (
      <p className="banner banner-success" role="status">
        {t('assistance.pending')}
      </p>
    );
  }
  return (
    <form action={action} className="stack-sm">
      <div className="field">
        <label htmlFor="as-kind">{t('report.stepSubcategory')}</label>
        <select id="as-kind" name="kind" className="select" required>
          {ASSISTANCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {tk(`assistance.kind.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="as-title">{t('assistance.titleLabel')}</label>
        <input id="as-title" name="title" className="input" minLength={5} maxLength={80} required />
      </div>
      <div className="field">
        <label htmlFor="as-description">{t('assistance.descriptionLabel')}</label>
        <textarea
          id="as-description"
          name="description"
          className="textarea"
          minLength={20}
          maxLength={1000}
          required
          aria-describedby="as-help"
        />
        <p id="as-help" className="hint">
          {t('assistance.intro')}
        </p>
      </div>
      <div className="field">
        <label htmlFor="as-commune">{t('assistance.communeLabel')}</label>
        <select id="as-commune" name="communeCode" className="select" required>
          {communes.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.wilaya})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="as-days">{t('assistance.expiresLabel')}</label>
        <select id="as-days" name="expiresInDays" className="select" defaultValue="7">
          {[3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              {t('assistance.expiresDays', { days: d })}
            </option>
          ))}
        </select>
      </div>
      {state && !state.ok && (
        <p className="error" role="alert">
          {tk(errorMessageKey(state.error))}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {t('assistance.create')}
      </button>
    </form>
  );
}
