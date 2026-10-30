import { fetchWithRetry } from '../http';
import type { AdapterContext, NormalizedObservation, SourceAdapter } from './types';

/**
 * NASA FIRMS — API « area » (https://firms.modaps.eosdis.nasa.gov/api/area/).
 * URL : /api/area/csv/{MAP_KEY}/{SOURCE}/{ouest,sud,est,nord}/{DAY_RANGE}
 * La clé MAP_KEY reste côté serveur. Un point chaud est une anomalie thermique détectée
 * par satellite : ce n'est JAMAIS un incendie confirmé (feux agricoles, industrie…).
 */
export const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
export const FIRMS_DEFAULT_PRODUCTS = [
  'VIIRS_SNPP_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
] as const;

export function buildFirmsUrl(
  mapKey: string,
  product: string,
  bbox: AdapterContext['bbox'],
  dayRange: number,
): string {
  const [west, south, east, north] = bbox;
  const area = [west, south, east, north].map((v) => v.toFixed(3)).join(',');
  const days = Math.min(Math.max(Math.round(dayRange), 1), 5);
  return `${FIRMS_BASE}/${encodeURIComponent(mapKey)}/${encodeURIComponent(product)}/${area}/${days}`;
}

const VIIRS_CONFIDENCE: Record<string, string> = { l: 'low', n: 'nominal', h: 'high' };

function parseCsvLine(line: string): string[] {
  // Les fichiers FIRMS ne contiennent pas de champs entre guillemets ; découpage simple.
  return line.split(',').map((c) => c.trim());
}

export function parseFirmsCsv(
  csv: string,
  product: string,
  sourceId = 'nasa_firms',
): NormalizedObservation[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0] ?? '').map((h) => h.toLowerCase());
  if (!header.includes('latitude') || !header.includes('acq_date')) {
    // Ex. « Invalid MAP_KEY. » : on remonte le message sans jamais le confondre avec des données.
    throw new Error(`Réponse FIRMS inattendue : ${lines[0]?.slice(0, 120)}`);
  }
  const at = (name: string) => header.indexOf(name);
  const out: NormalizedObservation[] = [];
  for (const line of lines.slice(1)) {
    const c = parseCsvLine(line);
    const lat = Number(c[at('latitude')]);
    const lng = Number(c[at('longitude')]);
    const date = c[at('acq_date')];
    const rawTime = (c[at('acq_time')] ?? '').padStart(4, '0');
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !date || !/^\d{4}$/.test(rawTime))
      continue;
    const observedAt = new Date(`${date}T${rawTime.slice(0, 2)}:${rawTime.slice(2)}:00Z`);
    if (Number.isNaN(observedAt.getTime())) continue;
    const rawConfidence = c[at('confidence')] ?? '';
    const confidence =
      VIIRS_CONFIDENCE[rawConfidence.toLowerCase()] ?? (rawConfidence ? `${rawConfidence}%` : null);
    const frp = Number(c[at('frp')]);
    out.push({
      sourceId,
      externalId: `${product}:${date}T${rawTime}:${lat.toFixed(4)},${lng.toFixed(4)}`,
      kind: 'thermal_hotspot',
      lat,
      lng,
      observedAt: observedAt.toISOString(),
      confidence,
      title: `${c[at('satellite')] ?? ''} ${c[at('instrument')] ?? ''}`.trim() || product,
      payload: {
        product,
        satellite: c[at('satellite')] ?? null,
        instrument: c[at('instrument')] ?? null,
        frpMw: Number.isFinite(frp) ? frp : null,
        daynight: c[at('daynight')] ?? null,
        version: c[at('version')] ?? null,
      },
    });
  }
  return out;
}

export const firmsAdapter: SourceAdapter = {
  id: 'nasa_firms',
  kind: 'thermal_hotspot',
  requiredSecret: 'nasaFirmsMapKey',
  license: 'Données NASA (politique de données ouvertes, citation demandée)',
  attribution: 'Points chauds : NASA FIRMS (LANCE)',
  documentationUrl: 'https://firms.modaps.eosdis.nasa.gov/api/',
  rateLimit: '5000 transactions par tranche de 10 minutes et par clé MAP_KEY',
  async fetchObservations(ctx) {
    const key = ctx.secrets.nasaFirmsMapKey;
    if (!key) throw new Error('missing_key');
    const products = Array.isArray(ctx.config.products)
      ? (ctx.config.products as string[])
      : [...FIRMS_DEFAULT_PRODUCTS];
    const dayRange = Number(ctx.config.dayRange ?? 1);
    const observations: NormalizedObservation[] = [];
    let httpStatus = 200;
    for (const product of products) {
      const response = await fetchWithRetry(
        buildFirmsUrl(key, product, ctx.bbox, dayRange),
        {},
        { fetchImpl: ctx.fetchImpl },
      );
      httpStatus = response.status;
      observations.push(...parseFirmsCsv(await response.text(), product));
    }
    return { observations, httpStatus };
  },
};
