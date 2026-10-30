import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Bell, House, Map, Megaphone, UserRound } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { ready, onboardingDone } = usePreferences();
  if (ready && !onboardingDone) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.primaryText,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: t('nav.map'),
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="signaler"
        options={{
          title: t('nav.report'),
          tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="alertes"
        options={{
          title: t('nav.alerts'),
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
