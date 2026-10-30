import * as Location from 'expo-location';
import type { LatLng } from '@tamurt/shared';

export type LocateResult =
  | { kind: 'ok'; position: LatLng; accuracyM: number | null }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * Position ponctuelle, uniquement à la demande de l'utilisateur (permission « pendant
 * l'utilisation »). Aucun suivi en arrière-plan ; la position n'est ni stockée ni envoyée
 * au serveur par cette fonction.
 */
export async function locateOnce(): Promise<LocateResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { kind: 'denied' };
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      kind: 'ok',
      position: { lat: position.coords.latitude, lng: position.coords.longitude },
      accuracyM: position.coords.accuracy ?? null,
    };
  } catch {
    return { kind: 'unavailable' };
  }
}
