import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import type { Locale } from '@tamurt/shared/i18n';
import { supabase } from './supabase';

/**
 * Notifications push via le service Expo (FCM / APNs). Le jeton n'est demandé qu'après
 * une action explicite de l'utilisateur ; il est enregistré côté serveur pour le ciblage
 * (lieux suivis, catégories, gravité). La réception n'est jamais garantie.
 */
const TOKEN_KEY = 'tamurt.push.token.v1';

// Canaux Android : « Critique » distinct pour que l'utilisateur puisse le régler séparément.
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Alertes',
    importance: AndroidImportance.HIGH,
    lightColor: '#D9261C',
  });
  await Notifications.setNotificationChannelAsync('alerts-critical', {
    name: 'Alertes critiques',
    importance: AndroidImportance.MAX,
    lightColor: '#B8261A',
    vibrationPattern: [0, 400, 200, 400],
  });
}

export function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export type PushStatus = 'registered' | 'denied' | 'no_device' | 'not_configured' | 'error';

export async function registerForPush(locale: Locale): Promise<PushStatus> {
  if (!supabase) return 'not_configured';
  if (!Device.isDevice) return 'no_device';
  const projectId = easProjectId();
  if (!projectId) return 'not_configured';
  try {
    await ensureChannels();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.rpc('register_push_token', {
      p_kind: 'expo',
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_token: token,
      p_locale: locale,
    });
    if (error) return 'error';
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'registered';
  } catch {
    return 'error';
  }
}

export async function storedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Désactive le jeton côté serveur (à la demande ou avant la déconnexion). */
export async function unregisterPush(): Promise<void> {
  const token = await storedPushToken();
  if (!token) return;
  if (supabase) await supabase.rpc('unregister_push_token', { p_token: token });
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/** Affichage au premier plan : bannière + liste, sans badge ni son forcé. */
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lien profond : identifiant d'événement extrait des données de la notification. */
export function eventIdFromNotification(data: unknown): string | null {
  const id = (data as { eventId?: unknown } | null)?.eventId;
  return typeof id === 'string' && UUID.test(id) ? id : null;
}
