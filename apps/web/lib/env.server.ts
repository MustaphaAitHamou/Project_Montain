import 'server-only';

/**
 * Variables d'environnement SERVEUR. Ne jamais les exposer au navigateur ni les journaliser.
 */
export interface ServerEnv {
  supabaseSecretKey: string | null;
  cronSecret: string | null;
  nasaFirmsMapKey: string | null;
  openMeteoApiKey: string | null;
  vapidPrivateKey: string | null;
  vapidSubject: string | null;
  expoAccessToken: string | null;
  requireAdminMfa: boolean;
}

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function getServerEnv(): ServerEnv {
  return {
    supabaseSecretKey: clean(process.env.SUPABASE_SECRET_KEY),
    cronSecret: clean(process.env.CRON_SECRET),
    nasaFirmsMapKey: clean(process.env.NASA_FIRMS_MAP_KEY),
    openMeteoApiKey: clean(process.env.OPEN_METEO_API_KEY),
    vapidPrivateKey: clean(process.env.VAPID_PRIVATE_KEY),
    vapidSubject: clean(process.env.VAPID_SUBJECT),
    expoAccessToken: clean(process.env.EXPO_ACCESS_TOKEN),
    // Par défaut le MFA administrateur est exigé en production.
    requireAdminMfa:
      process.env.REQUIRE_ADMIN_MFA === undefined
        ? process.env.NODE_ENV === 'production'
        : process.env.REQUIRE_ADMIN_MFA === 'true',
  };
}
