import 'server-only';
import { cache } from 'react';
import { getSession } from '@/lib/auth';

export interface EmergencyNumbers {
  verified: boolean;
  verified_at: string | null;
  items: { label: string; number: string }[];
}

export interface PublicSettings {
  demoMode: boolean;
  adsEnabled: boolean;
  emergencyNumbers: EmergencyNumbers;
}

const DEFAULTS: PublicSettings = {
  demoMode: false,
  adsEnabled: false,
  emergencyNumbers: { verified: false, verified_at: null, items: [] },
};

/** Paramètres publics (lecture RLS : seules les clés `is_public` sont visibles). */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  const { supabase } = await getSession();
  if (!supabase) return DEFAULTS;
  const { data } = await supabase.from('app_settings').select('key, value').eq('is_public', true);
  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  const emergency = map.get('emergency_numbers') as EmergencyNumbers | undefined;
  return {
    demoMode: map.get('demo_mode') === true,
    adsEnabled: map.get('ads_enabled') === true,
    emergencyNumbers:
      emergency && Array.isArray(emergency.items) ? emergency : DEFAULTS.emergencyNumbers,
  };
});
