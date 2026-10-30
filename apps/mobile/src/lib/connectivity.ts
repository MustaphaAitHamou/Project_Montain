import { useNetInfo } from '@react-native-community/netinfo';

/**
 * État du réseau. `null` tant que l'état est inconnu (démarrage) : on ne bloque alors
 * rien, mais on n'affirme pas non plus être en ligne.
 */
export function useOnline(): boolean | null {
  const { isConnected, isInternetReachable } = useNetInfo();
  if (isConnected === null) return null;
  return isConnected && isInternetReachable !== false;
}
