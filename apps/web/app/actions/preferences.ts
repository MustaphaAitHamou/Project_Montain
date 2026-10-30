'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocale } from '@tamurt/shared/i18n';
import { LOCALE_COOKIE, THEME_COOKIE } from '@/lib/i18n';
import { getSession } from '@/lib/auth';

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    path: '/',
    httpOnly: false,
  });
  const { supabase, user } = await getSession();
  if (supabase && user) {
    await supabase.from('profiles').update({ preferred_locale: locale }).eq('id', user.id);
  }
  revalidatePath('/', 'layout');
}

export async function setThemeAction(formData: FormData): Promise<void> {
  const theme = formData.get('theme');
  const store = await cookies();
  if (theme === 'light' || theme === 'dark') {
    store.set(THEME_COOKIE, theme, { maxAge: ONE_YEAR, sameSite: 'lax', path: '/' });
  } else {
    store.delete(THEME_COOKIE);
  }
  revalidatePath('/', 'layout');
}
