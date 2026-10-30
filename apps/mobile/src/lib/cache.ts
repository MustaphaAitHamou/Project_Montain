import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache local des dernières données publiques reçues (événements, lieux suivis…),
 * pour rester consultable hors connexion. Chaque entrée garde sa date d'enregistrement,
 * affichée à l'utilisateur : des données en cache ne sont jamais présentées comme à jour.
 */
export interface CacheEntry<T> {
  value: T;
  savedAt: string;
}

const PREFIX = 'tamurt.cache.v1.';

export async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<string> {
  const savedAt = new Date().toISOString();
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt }));
  } catch {
    // Stockage plein ou indisponible : le cache est une commodité, pas une obligation.
  }
  return savedAt;
}

/** Données personnelles en cache (lieux suivis, notifications) : effacées à la déconnexion. */
export async function clearPrivateCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(`${PREFIX}private.`)));
  } catch {
    // Rien à faire.
  }
}
