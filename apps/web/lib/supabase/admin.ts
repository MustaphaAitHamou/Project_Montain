import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tamurt/shared/database.types';
import { getPublicEnv } from '@/lib/env';
import { getServerEnv } from '@/lib/env.server';

export type ServiceSupabase = ReturnType<typeof createClient<Database>>;

/**
 * Client « service » : CONTOURNE la RLS. À n'utiliser que dans des routes serveur
 * après avoir vérifié l'identité et le rôle de l'appelant (voir lib/auth.ts).
 */
export function createServiceClient(): ServiceSupabase | null {
  const { supabaseUrl } = getPublicEnv();
  const { supabaseSecretKey } = getServerEnv();
  if (!supabaseUrl || !supabaseSecretKey) return null;
  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
