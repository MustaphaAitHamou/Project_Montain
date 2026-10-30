import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@tamurt/shared/database.types';
import { getPublicEnv, isSupabaseConfigured } from '@/lib/env';

export type ServerSupabase = ReturnType<typeof createServerClient<Database>>;

/**
 * Client Supabase côté serveur, lié à la session de l'utilisateur (cookies).
 * Toutes les requêtes sont soumises à la RLS. Retourne `null` si le backend n'est pas configuré.
 */
export async function createSupabaseServerClient(): Promise<ServerSupabase | null> {
  const env = getPublicEnv();
  if (!isSupabaseConfigured(env) || !env.supabaseUrl || !env.supabasePublishableKey) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}
