import type { BBox } from '@tamurt/shared';
import type { FetchLike } from '../http';

/** Observation normalisée, prête à être enregistrée dans `external_observations`. */
export interface NormalizedObservation {
  sourceId: string;
  externalId: string;
  kind: 'earthquake' | 'thermal_hotspot' | 'weather_forecast' | 'weather_warning';
  lat: number;
  lng: number;
  observedAt: string;
  magnitude?: number | null;
  depthKm?: number | null;
  confidence?: string | null;
  title?: string | null;
  payload: Record<string, unknown>;
}

export interface AdapterContext {
  bbox: BBox;
  now: Date;
  fetchImpl?: FetchLike;
  config: Record<string, unknown>;
  secrets: { nasaFirmsMapKey: string | null; openMeteoApiKey: string | null };
  /** Points de prévision (Open-Meteo), fournis par le runner à partir du référentiel. */
  forecastPoints?: { id: string; name: string; lat: number; lng: number }[];
}

export interface SourceAdapter {
  id: string;
  kind: NormalizedObservation['kind'];
  /** Clé requise côté serveur (jamais exposée au client). */
  requiredSecret: keyof AdapterContext['secrets'] | null;
  license: string;
  attribution: string;
  documentationUrl: string;
  /** Limite indicative de requêtes (documentation du fournisseur). */
  rateLimit: string;
  fetchObservations(
    ctx: AdapterContext,
  ): Promise<{ observations: NormalizedObservation[]; httpStatus: number }>;
}
