import 'server-only';
import { cookies, headers } from 'next/headers';
import {
  type Locale,
  LOCALE_INFO,
  getTranslator,
  isLocale,
  negotiateLocale,
} from '@tamurt/shared/i18n';

export const LOCALE_COOKIE = 'locale';
export const THEME_COOKIE = 'theme';
export type ThemePreference = 'light' | 'dark' | 'system';

export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  const acceptLanguage = (await headers()).get('accept-language') ?? '';
  return negotiateLocale(acceptLanguage.split(',').map((part) => part.trim()));
}

export async function getI18n() {
  const locale = await getLocale();
  const translator = getTranslator(locale);
  return { ...translator, info: LOCALE_INFO[locale] };
}

export async function getThemePreference(): Promise<ThemePreference> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return value === 'light' || value === 'dark' ? value : 'system';
}
