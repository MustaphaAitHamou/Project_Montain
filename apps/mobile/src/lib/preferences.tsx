import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type Locale, isLocale, negotiateLocale } from '@tamurt/shared/i18n';

export type ThemePreference = 'light' | 'dark' | 'system';

interface Preferences {
  locale: Locale;
  theme: ThemePreference;
  onboardingDone: boolean;
}

interface PreferencesValue extends Preferences {
  ready: boolean;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  completeOnboarding: () => void;
}

const STORAGE_KEY = 'tamurt.preferences.v1';

function deviceLocale(): Locale {
  try {
    return negotiateLocale(getLocales().map((l) => l.languageTag));
  } catch {
    return 'fr';
  }
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

/** Préférences locales de l'appareil (langue, thème, onboarding), persistées dans AsyncStorage. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>({
    locale: deviceLocale(),
    theme: 'system',
    onboardingDone: false,
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        setPrefs((current) => ({
          locale: isLocale(parsed.locale) ? parsed.locale : current.locale,
          theme:
            parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
              ? parsed.theme
              : current.theme,
          onboardingDone: parsed.onboardingDone === true,
        }));
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      ...prefs,
      ready,
      setLocale: (locale) => update({ locale }),
      setTheme: (theme) => update({ theme }),
      completeOnboarding: () => update({ onboardingDone: true }),
    }),
    [prefs, ready, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences doit être utilisé dans PreferencesProvider');
  return ctx;
}
