import { DEFAULT_REGION, type BBox } from '@tamurt/shared';
import type { FetchLike } from '../http';
import { HttpError } from '../http';
import { type ServiceClient, toPoint } from '../supabase';
import { earthquakeSeverity, emscAdapter } from './emsc';
import { firmsAdapter } from './firms';
import { openMeteoAdapter } from './openMeteo';
import type { NormalizedObservation, SourceAdapter } from './types';

export const ADAPTERS: Record<string, SourceAdapter> = {
  emsc: emscAdapter,
  nasa_firms: firmsAdapter,
  open_meteo: openMeteoAdapter,
};

export interface SyncDeps {
  secrets: { nasaFirmsMapKey: string | null; openMeteoApiKey: string | null };
  fetchImpl?: FetchLike;
  now?: () => Date;
  trigger?: 'schedule' | 'manual' | 'test';
  bbox?: BBox;
}

export type SyncOutcome =
  | {
      status: 'skipped';
      reason: 'disabled' | 'missing_key' | 'circuit_open' | 'unknown_source' | 'too_soon';
    }
  | { status: 'success'; fetched: number; upserted: number; eventsCreated: number }
  | { status: 'failed'; error: string; consecutiveFailures: number };

/** Disjoncteur : après 5 échecs consécutifs, pause croissante (15 min → 6 h maximum). */
export const CIRCUIT_THRESHOLD = 5;
export function circuitOpenUntil(consecutiveFailures: number, now: Date): Date | null {
  if (consecutiveFailures < CIRCUIT_THRESHOLD) return null;
  const minutes = Math.min(15 * 2 ** (consecutiveFailures - CIRCUIT_THRESHOLD), 360);
  return new Date(now.getTime() + minutes * 60_000);
}

async function forecastPoints(service: ServiceClient) {
  const { data } = await service.rpc('commune_points', { p_limit: 40 });
  return (data ?? []).map((r) => ({ id: r.code, name: r.name_fr, lat: r.lat, lng: r.lng }));
}

async function upsertObservations(
  service: ServiceClient,
  observations: NormalizedObservation[],
): Promise<number> {
  let count = 0;
  for (let i = 0; i < observations.length; i += 200) {
    const batch = observations.slice(i, i + 200).map((o) => ({
      source_id: o.sourceId,
      external_id: o.externalId,
      kind: o.kind,
      location: toPoint(o.lng, o.lat),
      observed_at: o.observedAt,
      magnitude: o.magnitude ?? null,
      depth_km: o.depthKm ?? null,
      confidence: o.confidence ?? null,
      title: o.title ?? null,
      payload: o.payload as never,
      fetched_at: new Date().toISOString(),
    }));
    const { error, count: n } = await service
      .from('external_observations')
      .upsert(batch, { onConflict: 'source_id,external_id', count: 'exact' });
    if (error) throw new Error(`upsert observations: ${error.message}`);
    count += n ?? batch.length;
  }
  return count;
}

/** Séismes au-dessus du seuil : événement public « confirmé » (source sismologique), mis à jour si révisé. */
async function upsertEarthquakeEvents(
  service: ServiceClient,
  observations: NormalizedObservation[],
  minMagnitude: number,
): Promise<number> {
  let created = 0;
  for (const o of observations) {
    if (o.kind !== 'earthquake' || (o.magnitude ?? 0) < minMagnitude) continue;
    const severity = earthquakeSeverity(o.magnitude ?? 0);
    const { data: existing } = await service
      .from('alert_events')
      .select('id, magnitude')
      .eq('external_source_id', o.sourceId)
      .eq('external_ref', o.externalId)
      .maybeSingle();
    const values = {
      location: toPoint(o.lng, o.lat),
      magnitude: o.magnitude ?? null,
      depth_km: o.depthKm ?? null,
      started_at: o.observedAt,
      external_url: (o.payload.url as string | undefined) ?? null,
      details: { location_name: o.title ?? null, mag_type: o.payload.magType ?? null } as never,
    };
    if (existing) {
      if (existing.magnitude !== o.magnitude) {
        await service.from('alert_events').update(values).eq('id', existing.id);
      }
    } else {
      const { data: inserted, error } = await service
        .from('alert_events')
        .insert({
          ...values,
          category_id: 'earthquake',
          subcategory_id: 'earthquake.recorded',
          status: 'confirmed',
          severity,
          source_kind: 'seismic',
          is_public: true,
          external_source_id: o.sourceId,
          external_ref: o.externalId,
        })
        .select('id')
        .single();
      if (error) throw new Error(`insert earthquake event: ${error.message}`);
      created += 1;
      await service
        .from('external_observations')
        .update({ event_id: inserted.id })
        .eq('source_id', o.sourceId)
        .eq('external_id', o.externalId);
      await service.from('alert_verifications').insert({
        event_id: inserted.id,
        method: 'seismic_network',
        verdict: 'supports',
        note: `EMSC ${o.externalId}`,
      });
    }
  }
  return created;
}

/**
 * Associe un point chaud satellite aux incendies actifs proches (≤ 3 km, ≤ 24 h) comme
 * INDICE (alert_verifications « satellite_correlation »). Le statut n'est jamais modifié.
 */
async function correlateHotspots(
  service: ServiceClient,
  observations: NormalizedObservation[],
): Promise<void> {
  for (const o of observations) {
    if (o.kind !== 'thermal_hotspot') continue;
    const { data: events } = await service.rpc('events_near', {
      p_lat: o.lat,
      p_lng: o.lng,
      p_radius_m: 3000,
      p_categories: ['fire'],
      p_active_only: true,
      p_limit: 5,
    });
    if (!events || events.length === 0) continue;
    const { data: obs } = await service
      .from('external_observations')
      .select('id')
      .eq('source_id', o.sourceId)
      .eq('external_id', o.externalId)
      .maybeSingle();
    if (!obs) continue;
    for (const e of events) {
      if (!e.id) continue;
      const { data: already } = await service
        .from('alert_verifications')
        .select('id')
        .eq('event_id', e.id)
        .eq('external_observation_id', obs.id)
        .maybeSingle();
      if (already) continue;
      await service.from('alert_verifications').insert({
        event_id: e.id,
        method: 'satellite_correlation',
        verdict: 'inconclusive',
        external_observation_id: obs.id,
        note: `Point chaud ${o.title ?? ''} à proximité (indice, pas une confirmation)`,
      });
    }
  }
}

export async function runSourceSync(
  service: ServiceClient,
  sourceId: string,
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const now = deps.now?.() ?? new Date();
  const adapter = ADAPTERS[sourceId];
  if (!adapter) return { status: 'skipped', reason: 'unknown_source' };
  const { data: source, error: sourceError } = await service
    .from('alert_sources')
    .select('*')
    .eq('id', sourceId)
    .single();
  if (sourceError || !source) return { status: 'skipped', reason: 'unknown_source' };

  const skip = async (reason: 'disabled' | 'missing_key' | 'circuit_open' | 'too_soon') => {
    await service.from('api_sync_runs').insert({
      source_id: sourceId,
      status: 'skipped',
      finished_at: now.toISOString(),
      error: reason,
      trigger: deps.trigger ?? 'schedule',
    });
    return { status: 'skipped' as const, reason };
  };

  if (!source.enabled) return skip('disabled');
  if (adapter.requiredSecret && !deps.secrets[adapter.requiredSecret]) return skip('missing_key');
  if (
    source.circuit_open_until &&
    Date.parse(source.circuit_open_until) > now.getTime() &&
    deps.trigger !== 'manual'
  ) {
    return skip('circuit_open');
  }

  const started = Date.now();
  const { data: run } = await service
    .from('api_sync_runs')
    .insert({ source_id: sourceId, status: 'running', trigger: deps.trigger ?? 'schedule' })
    .select('id')
    .single();

  try {
    const config = (source.config ?? {}) as Record<string, unknown>;
    const { observations, httpStatus } = await adapter.fetchObservations({
      bbox: deps.bbox ?? DEFAULT_REGION.sourceQueryBBox,
      now,
      fetchImpl: deps.fetchImpl,
      config,
      secrets: deps.secrets,
      forecastPoints: sourceId === 'open_meteo' ? await forecastPoints(service) : undefined,
    });
    const upserted = await upsertObservations(service, observations);
    let eventsCreated = 0;
    if (sourceId === 'emsc') {
      eventsCreated = await upsertEarthquakeEvents(
        service,
        observations,
        Number(config.eventMinMagnitude ?? 3),
      );
    }
    if (sourceId === 'nasa_firms') await correlateHotspots(service, observations);

    await service
      .from('alert_sources')
      .update({
        last_sync_at: now.toISOString(),
        last_success_at: now.toISOString(),
        last_error: null,
        consecutive_failures: 0,
        circuit_open_until: null,
      })
      .eq('id', sourceId);
    if (run) {
      await service
        .from('api_sync_runs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          items_fetched: observations.length,
          items_upserted: upserted,
          events_created: eventsCreated,
          http_status: httpStatus,
          duration_ms: Date.now() - started,
        })
        .eq('id', run.id);
    }
    return { status: 'success', fetched: observations.length, upserted, eventsCreated };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    const failures = (source.consecutive_failures ?? 0) + 1;
    const openUntil = circuitOpenUntil(failures, now);
    await service
      .from('alert_sources')
      .update({
        last_sync_at: now.toISOString(),
        last_error: message,
        consecutive_failures: failures,
        circuit_open_until: openUntil?.toISOString() ?? null,
      })
      .eq('id', sourceId);
    if (run) {
      await service
        .from('api_sync_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: message,
          http_status: error instanceof HttpError ? error.status : null,
          duration_ms: Date.now() - started,
        })
        .eq('id', run.id);
    }
    return { status: 'failed', error: message, consecutiveFailures: failures };
  }
}
