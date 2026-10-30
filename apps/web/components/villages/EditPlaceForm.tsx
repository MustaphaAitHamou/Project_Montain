'use client';

import { useActionState, useMemo } from 'react';
import {
  CATEGORIES,
  SEVERITIES,
  WATCH_RADIUS_OPTIONS_M,
  formatDistance,
  type Severity,
} from '@tamurt/shared';
import { getTranslator, type Locale } from '@tamurt/shared/i18n';
import { updateFollowedPlaceAction } from '@/app/actions/villages';

export interface EditablePlace {
  id: string;
  label: string;
  radius_m: number;
  categories: string[];
  notify: boolean;
  min_severity: Severity | null;
}

export function EditPlaceForm({ place, locale }: { place: EditablePlace; locale: Locale }) {
  const { t, tk } = useMemo(() => getTranslator(locale), [locale]);
  const [state, action, pending] = useActionState(updateFollowedPlaceAction, null);
  const radiusOptions = WATCH_RADIUS_OPTIONS_M.includes(
    place.radius_m as (typeof WATCH_RADIUS_OPTIONS_M)[number],
  )
    ? WATCH_RADIUS_OPTIONS_M
    : [...WATCH_RADIUS_OPTIONS_M, place.radius_m].sort((a, b) => a - b);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={place.id} />
      <div className="field">
        <label htmlFor="edit-label">{t('villages.customLabel')}</label>
        <input
          id="edit-label"
          name="label"
          className="input"
          maxLength={60}
          defaultValue={place.label}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="edit-radius">{t('villages.radius')}</label>
        <select id="edit-radius" name="radiusM" className="select" defaultValue={place.radius_m}>
          {radiusOptions.map((r) => (
            <option key={r} value={r}>
              {t('villages.radiusValue', { distance: formatDistance(r) })}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="stack-sm">
        <legend>{t('villages.categories')}</legend>
        <p className="hint">
          {t('villages.allCategories')} = {t('common.none')}
        </p>
        <div className="row">
          {CATEGORIES.filter((c) => c.module === 'alerts').map((c) => (
            <label key={c.id} className="chip">
              <input
                type="checkbox"
                name="categories"
                value={c.id}
                defaultChecked={place.categories.includes(c.id)}
              />
              {tk(`category.${c.id}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="checkbox-row">
        <input type="checkbox" name="notify" defaultChecked={place.notify} />
        {t('villages.notify')}
      </label>
      <div className="field">
        <label htmlFor="edit-severity">{t('villages.minSeverity')}</label>
        <select
          id="edit-severity"
          name="minSeverity"
          className="select"
          defaultValue={place.min_severity ?? ''}
        >
          <option value="">{t('villages.useGlobal')}</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {tk(`severity.${s}`)}
            </option>
          ))}
        </select>
      </div>
      {state?.ok && (
        <p className="banner banner-success" role="status">
          {t('villages.saved')}
        </p>
      )}
      {state && !state.ok && (
        <p className="banner banner-danger" role="alert">
          {t('common.errorGeneric')}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {t('common.save')}
      </button>
    </form>
  );
}
