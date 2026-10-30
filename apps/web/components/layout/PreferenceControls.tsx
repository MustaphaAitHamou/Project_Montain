import { LOCALES, LOCALE_INFO, type Locale } from '@tamurt/shared/i18n';
import { setLocaleAction, setThemeAction } from '@/app/actions/preferences';
import type { ThemePreference } from '@/lib/i18n';

interface Labels {
  language: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
  apply: string;
}

/**
 * Sélecteurs de langue et de thème. Formulaires HTML classiques (fonctionnent sans JavaScript),
 * traités par des Server Actions qui posent un cookie.
 */
export function PreferenceControls({
  locale,
  theme,
  labels,
}: {
  locale: Locale;
  theme: ThemePreference;
  labels: Labels;
}) {
  return (
    <div className="row" style={{ gap: 16 }}>
      <form action={setLocaleAction} className="row">
        <label htmlFor="pref-locale" className="small">
          {labels.language}
        </label>
        <select
          id="pref-locale"
          name="locale"
          defaultValue={locale}
          className="select"
          style={{ width: 'auto' }}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code} lang={code}>
              {LOCALE_INFO[code].nativeName}
              {LOCALE_INFO[code].reviewStatus === 'provisional' ? ' (provisoire)' : ''}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-sm btn-outline">
          {labels.apply}
        </button>
      </form>
      <form action={setThemeAction} className="row">
        <label htmlFor="pref-theme" className="small">
          {labels.theme}
        </label>
        <select
          id="pref-theme"
          name="theme"
          defaultValue={theme}
          className="select"
          style={{ width: 'auto' }}
        >
          <option value="system">{labels.system}</option>
          <option value="light">{labels.light}</option>
          <option value="dark">{labels.dark}</option>
        </select>
        <button type="submit" className="btn btn-sm btn-outline">
          {labels.apply}
        </button>
      </form>
    </div>
  );
}
