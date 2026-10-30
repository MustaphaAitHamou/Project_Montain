import { fetchWithRetry } from '../http';
import type { AdapterContext, NormalizedObservation, SourceAdapter } from './types';

/**
 * EMSC — service FDSN « event » (https://www.seismicportal.eu/fdsnws/event/1/).
 * Format texte standard FDSN (une ligne d'en-tête commençant par « # », colonnes séparées
 * par « | »). Les colonnes sont identifiées par leur nom d'en-tête, ce qui rend l'analyse
 * robuste à l'ajout de colonnes. Aucune clé n'est nécessaire.
 * Les séismes ne sont pas prévisibles : il s'agit d'événements déjà enregistrés.
 */
export const EMSC_ENDPOINT = 'https://www.seismicportal.eu/fdsnws/event/1/query';

export function buildEmscUrl(ctx: Pick<AdapterContext, 'bbox' | 'now' | 'config'>): string {
  const [west, south, east, north] = ctx.bbox;
  const lookbackHours = Number(ctx.config.lookbackHours ?? 72);
  const minMagnitude = Number(ctx.config.minMagnitude ?? 2.5);
  const start = new Date(ctx.now.getTime() - lookbackHours * 3600_000);
  const params = new URLSearchParams({
    format: 'text',
    starttime: start.toISOString().slice(0, 19),
    minlatitude: south.toFixed(3),
    maxlatitude: north.toFixed(3),
    minlongitude: west.toFixed(3),
    maxlongitude: east.toFixed(3),
    minmagnitude: String(minMagnitude),
    orderby: 'time',
    limit: '500',
  });
  return `${EMSC_ENDPOINT}?${params.toString()}`;
}

/** Lien vers les données d'origine (requête FDSN par identifiant d'événement). */
export function emscEventUrl(eventId: string): string {
  return `${EMSC_ENDPOINT}?${new URLSearchParams({ eventid: eventId, format: 'text' }).toString()}`;
}

function parseUtc(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function parseFdsnText(text: string, sourceId = 'emsc'): NormalizedObservation[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const headerLine = lines.find((l) => l.startsWith('#'));
  if (!headerLine) {
    // Réponse vide (aucun événement) ou erreur textuelle du service.
    if (lines.length === 0) return [];
    throw new Error(`Réponse FDSN inattendue : ${lines[0]?.slice(0, 120)}`);
  }
  const header = headerLine
    .replace(/^#/, '')
    .split('|')
    .map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = {
    id: col('EventID'),
    time: col('Time'),
    lat: col('Latitude'),
    lng: col('Longitude'),
    depth: col('Depth/km'),
    author: col('Author'),
    magType: col('MagType'),
    mag: col('Magnitude'),
    place: col('EventLocationName'),
  };
  if ([idx.id, idx.time, idx.lat, idx.lng, idx.mag].some((i) => i < 0)) {
    throw new Error('En-tête FDSN incomplet');
  }
  const out: NormalizedObservation[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const id = cells[idx.id];
    const observedAt = parseUtc(cells[idx.time] ?? '');
    const lat = Number(cells[idx.lat]);
    const lng = Number(cells[idx.lng]);
    const magnitude = Number(cells[idx.mag]);
    if (
      !id ||
      !observedAt ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(magnitude)
    )
      continue;
    const depth = idx.depth >= 0 ? Number(cells[idx.depth]) : NaN;
    const place = idx.place >= 0 ? (cells[idx.place] ?? null) : null;
    out.push({
      sourceId,
      externalId: id,
      kind: 'earthquake',
      lat,
      lng,
      observedAt,
      magnitude: Math.round(magnitude * 10) / 10,
      depthKm: Number.isFinite(depth) ? Math.round(depth * 10) / 10 : null,
      title: place,
      payload: {
        magType: idx.magType >= 0 ? cells[idx.magType] : null,
        author: idx.author >= 0 ? cells[idx.author] : null,
        locationName: place,
        url: emscEventUrl(id),
      },
    });
  }
  return out;
}

export const emscAdapter: SourceAdapter = {
  id: 'emsc',
  kind: 'earthquake',
  requiredSecret: null,
  license: "Conditions d'utilisation EMSC (à vérifier pour un usage commercial)",
  attribution: 'Données sismiques : EMSC-CSEM',
  documentationUrl: 'https://www.seismicportal.eu/fdsnws/event/1/',
  rateLimit: 'Usage raisonnable : une requête toutes les 10 minutes',
  async fetchObservations(ctx) {
    const response = await fetchWithRetry(buildEmscUrl(ctx), {}, { fetchImpl: ctx.fetchImpl });
    // FDSN : 204 = aucun événement.
    if (response.status === 204) return { observations: [], httpStatus: 204 };
    return { observations: parseFdsnText(await response.text()), httpStatus: response.status };
  },
};

/** Gravité attribuée automatiquement à un séisme enregistré (jamais « critique » sans modérateur). */
export function earthquakeSeverity(magnitude: number): 'information' | 'vigilance' | 'important' {
  if (magnitude >= 4.5) return 'important';
  if (magnitude >= 3) return 'vigilance';
  return 'information';
}
