import 'server-only';
import { ACTIVE_STATUSES, type VerificationStatus } from '@tamurt/shared';
import type { ServerSupabase } from '@/lib/supabase/server';
import { type EventView, toEventView } from '@/lib/events';

export interface EventQuery {
  categories?: string[];
  statuses?: readonly VerificationStatus[];
  sinceHours?: number;
  limit?: number;
}

export async function listPublicEvents(
  supabase: ServerSupabase,
  query: EventQuery = {},
): Promise<{ events: EventView[]; error: string | null; fetchedAt: string }> {
  let builder = supabase
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
      new Date(Date.now() - query.sinceHours * 3600_000).toISOString(),
    );
  }
  const { data, error } = await builder;
  return {
    events: (data ?? []).map(toEventView).filter((e): e is EventView => e !== null),
    error: error ? error.message : null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function listActiveEvents(supabase: ServerSupabase, limit = 100) {
  return listPublicEvents(supabase, { statuses: ACTIVE_STATUSES, limit });
}

export async function getPublicEvent(supabase: ServerSupabase, id: string) {
  const { data } = await supabase
    .from('event_feed')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();
  return data ? toEventView(data) : null;
}

export async function getEventTimeline(supabase: ServerSupabase, id: string) {
  const { data } = await supabase
    .from('alert_event_updates')
    .select('id, kind, old_status, new_status, old_severity, new_severity, message, created_at')
    .eq('event_id', id)
    .eq('is_public', true)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getEventVerifications(supabase: ServerSupabase, id: string) {
  const { data } = await supabase
    .from('alert_verifications')
    .select('id, method, verdict, note, evidence_url, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getEventMedia(supabase: ServerSupabase, eventId: string) {
  const { data } = await supabase
    .from('alert_media')
    .select('id, public_path, width, height')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .not('public_path', 'is', null);
  return data ?? [];
}

export async function getPublicSources(supabase: ServerSupabase) {
  const { data } = await supabase
    .from('alert_sources')
    .select('id, name, kind, attribution, enabled, last_success_at')
    .order('id');
  return data ?? [];
}
