import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tamurt/shared/database.types';

export type ServiceClient = SupabaseClient<Database>;

/** Client « service » : contourne la RLS. Réservé aux tâches serveur de confiance. */
export function createServiceClient(url: string, secretKey: string): ServiceClient {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function toPoint(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}
