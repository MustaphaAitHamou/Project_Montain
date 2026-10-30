import { TurboModuleRegistry } from 'react-native';

/**
 * Le module MapLibre est natif : il est présent dans une version compilée (EAS / expo run),
 * mais pas dans Expo Go. On le détecte sans l'importer (son import échouerait), et les
 * écrans basculent alors sur une présentation en liste.
 */
export const nativeMapAvailable: boolean = (() => {
  try {
    return Boolean(TurboModuleRegistry.get('MLRNLogModule'));
  } catch {
    return false;
  }
})();
