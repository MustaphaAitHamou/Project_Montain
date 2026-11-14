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
  /** Adresse de Tamurt Services (la maison mère) : active le bouton yaz. Vide : pas de bouton. */
  tamurtServicesUrl: string | null;
}

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Une adresse http(s) valide, sinon rien : le bouton yaz ne pointe jamais vers un lien mort ou dangereux. */
function httpUrl(value: string | undefined): string | null {
  const v = clean(value);
  if (!v) return null;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
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
    tamurtServicesUrl: httpUrl(process.env.TAMURT_SERVICES_URL),
    // Par défaut le MFA administrateur est exigé en production.
    requireAdminMfa:
      process.env.REQUIRE_ADMIN_MFA === undefined
        ? process.env.NODE_ENV === 'production'
        : process.env.REQUIRE_ADMIN_MFA === 'true',
  };
}
