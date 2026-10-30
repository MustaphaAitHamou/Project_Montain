import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from '@tamurt/shared/theme';
import { usePreferences } from '@/lib/preferences';

interface ThemeValue {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'light', colors: lightColors });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const { theme } = usePreferences();
  const scheme: 'light' | 'dark' =
    theme === 'system' ? (system === 'dark' ? 'dark' : 'light') : theme;
  const value = useMemo<ThemeValue>(
    () => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
