import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tamurt/shared/database.types';
import { env } from './env';
import { secureStorage } from './secureStorage';

export type MobileSupabase = SupabaseClient<Database>;

export const supabase: MobileSupabase | null =
  env.supabaseUrl && env.supabasePublishableKey
    ? createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
        auth: {
          storage: secureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Rafraîchissement du jeton uniquement quand l'application est au premier plan.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
