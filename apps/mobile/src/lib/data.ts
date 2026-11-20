import {
  ACTIVE_STATUSES,
  DEFAULT_REGION,
  type BBox,
  type EventView,
  type VerificationStatus,
  toEventView,
} from '@tamurt/shared';
import type { Database } from '@tamurt/shared/database.types';
import { env } from './env';
import { supabase, type MobileSupabase } from './supabase';

/** Erreur levée quand le backend n'est pas configuré (variables EXPO_PUBLIC_* absentes). */
export class BackendNotConfiguredError extends Error {
  constructor() {
    super('backend_not_configured');
  }
}

function client(): MobileSupabase {
  if (!supabase) throw new BackendNotConfiguredError();
  return supabase;
}

function rows<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('empty_response');
  return result.data;
}

function toViews(list: Database['public']['Views']['event_feed']['Row'][]): EventView[] {
  return list.map(toEventView).filter((e): e is EventView => e !== null);
}

export interface EventQuery {
  categories?: string[];
  statuses?: readonly VerificationStatus[];
  sinceHours?: number;
  limit?: number;
}

/** Événements publics (validés ou issus de sources externes), du plus récent au plus ancien. */
export async function fetchEvents(query: EventQuery = {}): Promise<EventView[]> {
  let builder = client()
    .from('event_feed')
    .select('*')
    .eq('is_public', true)
    .order('last_activity_at', { ascending: false })
    .limit(query.limit ?? 50);
  if (query.categories && query.categories.length > 0)
    builder = builder.in('category_id', query.categories);
  if (query.statuses && query.statuses.length > 0)
    builder = builder.in('status', [...query.statuses]);
  if (query.sinceHours) {
    builder = builder.gte(
      'last_activity_at',
      new Date(Date.now() - query.sinceHours * 3_600_000).toISOString(),
    );
  }
  return toViews(rows(await builder));
}

export function fetchActiveEvents(limit = 200): Promise<EventView[]> {
  return fetchEvents({ statuses: ACTIVE_STATUSES, limit });
}

/** Requête spatiale (PostGIS) sur l'emprise affichée. */
export async function fetchEventsInBBox(
  bbox: BBox,
  options: { categories?: string[]; activeOnly?: boolean; sinceHours?: number } = {},
): Promise<EventView[]> {
  const [west, south, east, north] = bbox;
  const result = await client().rpc('events_in_bbox', {
    p_west: west,
    p_south: south,
    p_east: east,
    p_north: north,
    p_categories:
      options.categories && options.categories.length > 0 ? options.categories : undefined,
    p_statuses: options.activeOnly === false ? undefined : [...ACTIVE_STATUSES],
    p_since: options.sinceHours
      ? new Date(Date.now() - options.sinceHours * 3_600_000).toISOString()
      : undefined,
    p_limit: 500,
  });
  return toViews(rows(result));
}

export async function fetchEvent(id: string): Promise<EventView | null> {
  const result = await client()
    .from('event_feed')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data ? toEventView(result.data) : null;
}

export async function fetchTimeline(id: string) {
  return rows(
    await client()
      .from('alert_event_updates')
      .select('id, kind, old_status, new_status, old_severity, new_severity, message, created_at')
      .eq('event_id', id)
      .eq('is_public', true)
      .order('created_at', { ascending: true }),
  );
}

export async function fetchEventMedia(id: string) {
  const list = rows(
    await client()
      .from('alert_media')
      .select('id, public_path, width, height')
      .eq('event_id', id)
      .eq('status', 'approved')
      .not('public_path', 'is', null),
  );
  return list.map((m) => ({
    ...m,
    url: m.public_path
      ? client().storage.from('report-media-public').getPublicUrl(m.public_path).data.publicUrl
      : null,
  }));
}

export type PlaceResult = Database['public']['Functions']['search_places']['Returns'][number];

export async function searchPlaces(q: string, max = 10): Promise<PlaceResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  return rows(await client().rpc('search_places', { q: trimmed, max_results: max }));
}

export type FollowedPlaceSummary =
  Database['public']['Functions']['my_followed_places_summary']['Returns'][number];

export async function fetchFollowedPlaces(): Promise<FollowedPlaceSummary[]> {
  return rows(await client().rpc('my_followed_places_summary'));
}

export async function fetchNotifications() {
  return rows(
    await client()
      .from('user_notifications')
      .select('id, kind, reason, title, body, severity, data, event_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export async function fetchMyReports(userId: string) {
  return rows(
    await client()
      .from('alert_reports')
      .select(
        'id, subcategory_id, description, moderation_status, rejection_reason, event_id, created_at, commune_code',
      )
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export async function fetchSources() {
  return rows(
    await client()
      .from('alert_sources')
      .select('id, name, kind, attribution, enabled, last_success_at')
      .order('id'),
  );
}

/** Lien vers la page web équivalente (mentions légales, export de données, etc.). */
export function webUrl(path: string): string {
  return `${env.siteUrl.replace(/\/$/, '')}${path}`;
}

export const COVERAGE_BBOX: BBox = DEFAULT_REGION.bbox;

/** Historique des événements autour d'un lieu suivi (PostGIS, rayon en mètres). */
export async function fetchEventsNear(
  center: { lat: number; lng: number },
  radiusM: number,
  categories: string[] = [],
): Promise<EventView[]> {
  const result = await client().rpc('events_near', {
    p_lat: center.lat,
    p_lng: center.lng,
    p_radius_m: radiusM,
    p_active_only: false,
    p_categories: categories.length > 0 ? categories : undefined,
    p_limit: 50,
  });
  return toViews(rows(result));
}
