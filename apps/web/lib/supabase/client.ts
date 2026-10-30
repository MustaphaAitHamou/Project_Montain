'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@tamurt/shared/database.types';
import { getPublicEnv } from '@/lib/env';

export type BrowserSupabase = ReturnType<typeof createBrowserClient<Database>>;

let client: BrowserSupabase | null = null;

/** Client navigateur (clé publiable uniquement, RLS appliquée). `null` si non configuré. */
export function getSupabaseBrowserClient(): BrowserSupabase | null {
  const env = getPublicEnv();
  if (!env.supabaseUrl || !env.supabasePublishableKey) return null;
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey);
  return client;
}
