import { fetchWithRetry } from '../http';
import type { AdapterContext, NormalizedObservation, SourceAdapter } from './types';

/**
 * Open-Meteo — prévisions horaires (https://open-meteo.com/en/docs).
 * - API gratuite (api.open-meteo.com) réservée à un usage NON commercial.
 * - Offre commerciale : customer-api.open-meteo.com avec `apikey`.
 * Les signaux produits sont des PRÉVISIONS de modèle, distinctes de toute vigilance officielle.
 */
export const OPEN_METEO_FREE = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_COMMERCIAL = 'https://customer-api.open-meteo.com/v1/forecast';

export interface ForecastThresholds {
  precipitationMmPerHour: number;
  windGustsKmh: number;
  temperatureMaxC: number;
  temperatureMinC: number;
}

export const DEFAULT_THRESHOLDS: ForecastThresholds = {
  precipitationMmPerHour: 10,
  windGustsKmh: 80,
  temperatureMaxC: 40,
  temperatureMinC: -2,
};

export function buildOpenMeteoUrl(
  points: { lat: number; lng: number }[],
  apiKey: string | null,
): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lng.toFixed(4)).join(','),
    hourly: 'precipitation,wind_gusts_10m,temperature_2m',
    forecast_days: '2',
    timezone: 'GMT',
    wind_speed_unit: 'kmh',
  });
  if (apiKey) params.set('apikey', apiKey);
  return `${apiKey ? OPEN_METEO_COMMERCIAL : OPEN_METEO_FREE}?${params.toString()}`;
}

interface HourlyBlock {
  time?: string[];
  precipitation?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  temperature_2m?: (number | null)[];
}

type Signal = 'heavy_precipitation' | 'strong_wind' | 'heat' | 'frost';

function maxWithIndex(
  values: (number | null)[] | undefined,
): { value: number; index: number } | null {
  let best: { value: number; index: number } | null = null;
  (values ?? []).forEach((v, index) => {
    if (typeof v === 'number' && (!best || v > best.value)) best = { value: v, index };
  });
  return best;
}

function minWithIndex(
  values: (number | null)[] | undefined,
): { value: number; index: number } | null {
  let best: { value: number; index: number } | null = null;
  (values ?? []).forEach((v, index) => {
    if (typeof v === 'number' && (!best || v < best.value)) best = { value: v, index };
  });
  return best;
}

export function parseOpenMeteo(
  body: unknown,
  points: { id: string; name: string; lat: number; lng: number }[],
  thresholds: ForecastThresholds = DEFAULT_THRESHOLDS,
  sourceId = 'open_meteo',
): NormalizedObservation[] {
  const blocks = (Array.isArray(body) ? body : [body]) as { hourly?: HourlyBlock }[];
  if (blocks.length !== points.length)
    throw new Error('Réponse Open-Meteo : nombre de points inattendu');
  const out: NormalizedObservation[] = [];
  blocks.forEach((block, i) => {
    const point = points[i];
    const hourly = block?.hourly;
    if (!point || !hourly?.time) return;
    const at = (index: number) => {
      const t = hourly.time?.[index];
      return t ? new Date(`${t}:00Z`).toISOString() : null;
    };
    const candidates: {
      signal: Signal;
      value: number;
      index: number;
      unit: string;
      label: string;
    }[] = [];
    const rain = maxWithIndex(hourly.precipitation);
    if (rain && rain.value >= thresholds.precipitationMmPerHour) {
      candidates.push({
        signal: 'heavy_precipitation',
        ...rain,
        unit: 'mm/h',
        label: 'Précipitations intenses prévues',
      });
    }
    const gust = maxWithIndex(hourly.wind_gusts_10m);
    if (gust && gust.value >= thresholds.windGustsKmh) {
      candidates.push({
        signal: 'strong_wind',
        ...gust,
        unit: 'km/h',
        label: 'Rafales de vent prévues',
      });
    }
    const hot = maxWithIndex(hourly.temperature_2m);
    if (hot && hot.value >= thresholds.temperatureMaxC) {
      candidates.push({ signal: 'heat', ...hot, unit: '°C', label: 'Fortes chaleurs prévues' });
    }
    const cold = minWithIndex(hourly.temperature_2m);
    if (cold && cold.value <= thresholds.temperatureMinC) {
      candidates.push({ signal: 'frost', ...cold, unit: '°C', label: 'Gel prévu' });
    }
    for (const c of candidates) {
      const observedAt = at(c.index);
      if (!observedAt) continue;
      out.push({
        sourceId,
        externalId: `${point.id}:${c.signal}:${observedAt.slice(0, 13)}`,
        kind: 'weather_forecast',
        lat: point.lat,
        lng: point.lng,
        observedAt,
        title: `${c.label} : ${c.value} ${c.unit} (${point.name})`,
        payload: {
          signal: c.signal,
          value: c.value,
          unit: c.unit,
          point: point.name,
          model: 'Open-Meteo',
        },
      });
    }
  });
  return out;
}

export const openMeteoAdapter: SourceAdapter = {
  id: 'open_meteo',
  kind: 'weather_forecast',
  requiredSecret: null,
  license:
    'API gratuite : usage non commercial uniquement ; offre commerciale avec clé. Données CC BY 4.0.',
  attribution: 'Prévisions météo : Open-Meteo.com',
  documentationUrl: 'https://open-meteo.com/en/docs',
  rateLimit: 'Offre gratuite : 10 000 appels par jour (chaque point compte)',
  async fetchObservations(ctx: AdapterContext) {
    const points = ctx.forecastPoints ?? [];
    if (points.length === 0) return { observations: [], httpStatus: 200 };
    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...((ctx.config.thresholds as Partial<ForecastThresholds>) ?? {}),
    };
    const observations: NormalizedObservation[] = [];
    let httpStatus = 200;
    for (let i = 0; i < points.length; i += 50) {
      const batch = points.slice(i, i + 50);
      const response = await fetchWithRetry(
        buildOpenMeteoUrl(batch, ctx.secrets.openMeteoApiKey),
        {},
        { fetchImpl: ctx.fetchImpl },
      );
      httpStatus = response.status;
      observations.push(...parseOpenMeteo(await response.json(), batch, thresholds));
    }
    return { observations, httpStatus };
  },
};
