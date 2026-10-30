import { useMemo } from 'react';
import { LOCALE_INFO, getTranslator } from '@tamurt/shared/i18n';
import { usePreferences } from './preferences';

export function useI18n() {
  const { locale } = usePreferences();
  return useMemo(() => ({ ...getTranslator(locale), info: LOCALE_INFO[locale] }), [locale]);
}
