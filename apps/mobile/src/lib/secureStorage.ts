import * as SecureStore from 'expo-secure-store';

/**
 * Stockage de session dans le trousseau sécurisé (Keychain iOS / Keystore Android).
 * SecureStore limite chaque valeur à ~2 Ko : la session est découpée en morceaux.
 */
const CHUNK = 1800;

function keyFor(key: string, index: number | 'n'): string {
  return `${key.replace(/[^A-Za-z0-9._-]/g, '_')}.${index}`;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(keyFor(key, 'n')));
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(keyFor(key, i));
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(keyFor(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(keyFor(key, 'n'), String(count));
  },
  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(keyFor(key, 'n')));
    for (let i = 0; i < (count || 0); i += 1) {
      await SecureStore.deleteItemAsync(keyFor(key, i));
    }
    await SecureStore.deleteItemAsync(keyFor(key, 'n'));
  },
};
