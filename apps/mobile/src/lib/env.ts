/**
 * Configuration publique de l'application mobile (variables EXPO_PUBLIC_*).
 * Aucune clé secrète ne doit figurer ici : tout ce qui est embarqué est extractible.
 */
function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export const env = {
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: clean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  siteUrl: clean(process.env.EXPO_PUBLIC_SITE_URL) ?? 'http://localhost:3000',
  mapStyleUrl: clean(process.env.EXPO_PUBLIC_MAP_STYLE_URL),
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
