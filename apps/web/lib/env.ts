/**
 * Variables d'environnement PUBLIQUES (exposées au navigateur).
 * Next.js n'injecte une variable NEXT_PUBLIC_* que si elle est référencée littéralement :
 * ne pas factoriser ces accès.
 * Les variables serveur sont dans `env.server.ts` (import `server-only`).
 */
export interface PublicEnv {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  siteUrl: string;
  mapStyleUrl: string | null;
  satelliteTilesUrl: string | null;
  satelliteAttribution: string | null;
  vapidPublicKey: string | null;
  demoMode: boolean;
}

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabasePublishableKey: clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    siteUrl: clean(process.env.NEXT_PUBLIC_SITE_URL) ?? 'http://localhost:3000',
    mapStyleUrl: clean(process.env.NEXT_PUBLIC_MAP_STYLE_URL),
    satelliteTilesUrl: clean(process.env.NEXT_PUBLIC_SATELLITE_TILES_URL),
    satelliteAttribution: clean(process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION),
    vapidPublicKey: clean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  };
}

export function isSupabaseConfigured(env: PublicEnv = getPublicEnv()): boolean {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}
