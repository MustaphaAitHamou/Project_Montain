import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { LIMITS } from '@tamurt/shared';
import { base64ToBytes, fitWithin } from './imageLogic';

export interface PreparedPhoto {
  uri: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type PickResult =
  | { kind: 'ok'; photo: PreparedPhoto }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'too_large' }
  | { kind: 'error' };

/**
 * Sélection (galerie ou appareil photo) puis ré-encodage JPEG : l'image est redessinée,
 * ses métadonnées EXIF (dont la position GPS) ne sont pas recopiées. Le serveur ré-encode
 * de nouveau l'image avant toute publication (défense en profondeur).
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { kind: 'cancelled' };
  try {
    const target = fitWithin(asset.width, asset.height, 1600);
    const context = ImageManipulator.manipulate(asset.uri);
    if (target.width !== asset.width)
      context.resize({ width: target.width, height: target.height });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: 0.85,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!saved.base64) return { kind: 'error' };
    const bytes = base64ToBytes(saved.base64);
    if (bytes.byteLength > LIMITS.mediaMaxBytes) return { kind: 'too_large' };
    return {
      kind: 'ok',
      photo: { uri: saved.uri, bytes, width: saved.width, height: saved.height },
    };
  } catch {
    return { kind: 'error' };
  }
}
