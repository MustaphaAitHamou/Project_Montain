import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import type { AppRole } from '@tamurt/shared';

export const config = () => inject('supabase');

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

export function anonClient(): SupabaseClient {
  return createClient(config().apiUrl, config().publishableKey, clientOptions);
}

export function serviceClient(): SupabaseClient {
  return createClient(config().apiUrl, config().secretKey, clientOptions);
}

let pool: pg.Pool | null = null;
export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: config().dbUrl, max: 3 });
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

const createdUsers: string[] = [];

/** Crée un utilisateur confirmé (API admin) et ouvre une session avec la clé publiable. */
export async function createUser(label: string, roles: AppRole[] = []): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.tamurt.invalid`;
  const password = `Motdepasse${Math.floor(Math.random() * 1e6)}`;
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: label.slice(0, 30) },
  });
  if (error || !data.user) throw error ?? new Error('createUser');
  createdUsers.push(data.user.id);
  for (const role of roles) {
    await db().query(
      `insert into public.user_roles (user_id, role, reason) values ($1, $2, 'test') on conflict do nothing`,
      [data.user.id, role],
    );
  }
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, password, client };
}

export async function deleteCreatedUsers(): Promise<void> {
  const admin = serviceClient();
  const ids = createdUsers.splice(0);
  // Les signalements de test encore en attente sont retirés : ils n'encombrent pas la file de
  // modération de la base locale (la suppression du compte ne fait que les anonymiser).
  if (ids.length > 0) {
    await admin
      .from('alert_reports')
      .update({ moderation_status: 'withdrawn', withdrawn_at: new Date().toISOString() })
      .in('author_id', ids)
      .eq('moderation_status', 'pending');
  }
  for (const id of ids) {
    await admin.auth.admin.deleteUser(id);
  }
}

/** Point situé dans la commune de Tizi Ouzou (1501). */
export const TIZI_OUZOU = { lat: 36.7118, lng: 4.0459 };
/** Point situé à Alger (commune couverte depuis l'extension nationale). */
export const ALGER = { lat: 36.7538, lng: 3.0588 };
/** Point situé à Tamanrasset (1101), dans le Grand Sud. */
export const TAMANRASSET = { lat: 22.785, lng: 5.5228 };
/** Point situé à Tunis (Tunisie), hors du territoire couvert. */
export const TUNIS = { lat: 36.8065, lng: 10.1815 };

export function reportParams(overrides: Record<string, unknown> = {}) {
  return {
    p_client_id: randomUUID(),
    p_category_id: 'fire',
    p_subcategory_id: 'fire.smoke',
    p_description: 'Fumée visible au-dessus de la forêt, côté nord du village.',
    p_lat: TIZI_OUZOU.lat,
    p_lng: TIZI_OUZOU.lng,
    p_location_precision: 'approximate',
    p_location_uncertainty_m: null,
    p_observed_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db().query(`update public.app_settings set value = $2::jsonb where key = $1`, [
    key,
    JSON.stringify(value),
  ]);
}
