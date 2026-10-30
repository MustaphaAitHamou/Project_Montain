import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Configuration Expo dynamique. Les valeurs publiques (URL Supabase, clé publiable,
 * style de carte) proviennent des variables EXPO_PUBLIC_* — jamais de secret ici :
 * tout ce qui est dans l'application mobile peut être extrait.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tamurt Alerte',
  slug: 'tamurt-alerte',
  scheme: 'tamurtalerte',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.tamurtservices.alerte',
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Votre position est utilisée uniquement à votre demande, pour centrer la carte ou proposer un point de départ lors d’un signalement. Elle n’est pas suivie en arrière-plan.',
      NSPhotoLibraryUsageDescription:
        'Permet de joindre une photo à un signalement. Les métadonnées (dont la position GPS) sont supprimées avant envoi.',
      NSCameraUsageDescription:
        'Permet de photographier un phénomène pour l’ajouter à un signalement.',
    },
  },
  android: {
    package: 'com.tamurtservices.alerte',
    // Permissions minimales : pas de localisation en arrière-plan.
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
    adaptiveIcon: { backgroundColor: '#153D30' },
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Votre position est utilisée uniquement à votre demande, pour centrer la carte ou proposer un point de départ lors d’un signalement.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    ['expo-notifications', { color: '#153D30' }],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Permet de joindre une photo à un signalement. Les métadonnées sont supprimées avant envoi.',
        cameraPermission: 'Permet de photographier un phénomène pour un signalement.',
        microphonePermission: false,
      },
    ],
    'expo-secure-store',
    '@maplibre/maplibre-react-native',
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
