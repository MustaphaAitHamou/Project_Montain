import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PreferencesProvider } from '@/lib/preferences';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { configureForegroundHandler, eventIdFromNotification } from '@/lib/push';
import { flushQueue } from '@/lib/offlineQueue';

configureForegroundHandler();

/** Ouverture d'une notification → fiche de l'événement (lien profond). */
function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const eventId = eventIdFromNotification(response.notification.request.content.data);
    if (eventId) router.push({ pathname: '/alerte/[id]', params: { id: eventId } });
    else router.push('/notifications');
  }, [response]);
  return null;
}

function RootNavigator() {
  const { colors, scheme } = useTheme();
  const { t, dir } = useI18n();

  useEffect(() => {
    void flushQueue();
  }, []);

  return (
    // La direction RTL est appliquée via le style (pas de redémarrage nécessaire).
    <View style={{ flex: 1, direction: dir, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NotificationRouter />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.primaryText,
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: t('common.back'),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="alerte/[id]" options={{ title: t('common.details') }} />
        <Stack.Screen name="villages/index" options={{ title: t('villages.title') }} />
        <Stack.Screen name="villages/ajouter" options={{ title: t('villages.add') }} />
        <Stack.Screen name="notifications/index" options={{ title: t('notifications.title') }} />
        <Stack.Screen
          name="notifications/preferences"
          options={{ title: t('notifications.preferences') }}
        />
        <Stack.Screen name="signalements" options={{ title: t('report.myReports') }} />
        <Stack.Screen name="connexion" options={{ title: t('auth.signInTitle') }} />
        <Stack.Screen name="inscription" options={{ title: t('auth.signUpTitle') }} />
        <Stack.Screen name="mot-de-passe-oublie" options={{ title: t('auth.resetTitle') }} />
        <Stack.Screen name="sources" options={{ title: t('home.sourcesTitle') }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <ThemeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ThemeProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
