/**
 * IMPORTANT : les échantillons ci-dessous sont SYNTHÉTIQUES. Ils reproduisent la structure
 * documentée des formats (FDSN texte, CSV FIRMS, JSON Open-Meteo) pour tester l'analyse ;
 * ils ne décrivent aucun événement réel. Le fonctionnement en direct des API n'est pas
 * vérifié par ces tests.
 */
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_REGION } from '@tamurt/shared';
import { backoffDelay, fetchWithRetry, HttpError } from '../http';
import { buildEmscUrl, earthquakeSeverity, parseFdsnText } from './emsc';
import { buildFirmsUrl, parseFirmsCsv } from './firms';
import { buildOpenMeteoUrl, parseOpenMeteo } from './openMeteo';
import { circuitOpenUntil } from './runner';

const SYNTHETIC_FDSN = [
  '#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType',
  'TEST_0001|2026-07-15T10:20:30.5|36.81|4.62|10.0|EMSC|EMSC-RTS|EMSC|TEST_0001|ml|3.4|EMSC|SYNTHETIC LOCATION|ke',
  'TEST_0002|2026-07-15T09:00:00Z|36.95|5.30|7.5|EMSC|EMSC-RTS|EMSC|TEST_0002|mb|4.6|EMSC|SYNTHETIC OFFSHORE|ke',
  'BROKEN|pas-une-date|x|y|||||||||',
].join('\n');

describe('EMSC (format texte FDSN)', () => {
  it('construit une requête bornée à la zone et à la période', () => {
    const url = new URL(
      buildEmscUrl({
        bbox: DEFAULT_REGION.sourceQueryBBox,
        now: new Date('2026-07-15T12:00:00Z'),
        config: {},
      }),
    );
    expect(url.searchParams.get('format')).toBe('text');
    expect(url.searchParams.get('minlatitude')).toBe('18.500');
    expect(url.searchParams.get('maxlongitude')).toBe('12.300');
    expect(url.searchParams.get('starttime')).toBe('2026-07-12T12:00:00');
    expect(url.searchParams.get('minmagnitude')).toBe('2.5');
  });

  it('analyse les colonnes par nom et ignore les lignes invalides', () => {
    const items = parseFdsnText(SYNTHETIC_FDSN);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: 'TEST_0001',
      kind: 'earthquake',
      lat: 36.81,
      lng: 4.62,
      magnitude: 3.4,
      depthKm: 10,
      observedAt: '2026-07-15T10:20:30.500Z',
      title: 'SYNTHETIC LOCATION',
    });
    expect(String(items[0]?.payload.url)).toContain('eventid=TEST_0001');
  });

  it('accepte une réponse vide et refuse une réponse non FDSN', () => {
    expect(parseFdsnText('')).toEqual([]);
    expect(() => parseFdsnText('Error 400: Bad Request')).toThrow();
  });

  it('ne déclare jamais automatiquement un séisme « critique »', () => {
    expect(earthquakeSeverity(2.5)).toBe('information');
    expect(earthquakeSeverity(3.4)).toBe('vigilance');
    expect(earthquakeSeverity(7.2)).toBe('important');
  });
});

const SYNTHETIC_FIRMS_VIIRS = [
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight',
  '36.60000,4.20000,330.1,0.39,0.36,2026-07-15,130,N,VIIRS,n,2.0NRT,295.2,4.8,D',
  '36.70000,4.30000,350.5,0.40,0.37,2026-07-15,1312,N,VIIRS,h,2.0NRT,300.1,12.2,D',
].join('\n');

describe('NASA FIRMS (CSV)', () => {
  it('ne place jamais la clé ailleurs que dans l’URL serveur', () => {
    const url = buildFirmsUrl('CLE_TEST', 'VIIRS_SNPP_NRT', [2.9, 35.3, 6.3, 37.5], 1);
    expect(url).toBe(
      'https://firms.modaps.eosdis.nasa.gov/api/area/csv/CLE_TEST/VIIRS_SNPP_NRT/2.900,35.300,6.300,37.500/1',
    );
  });

  it('normalise les points chauds (heure UTC sur 4 chiffres, confiance VIIRS)', () => {
    const items = parseFirmsCsv(SYNTHETIC_FIRMS_VIIRS, 'VIIRS_SNPP_NRT');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      kind: 'thermal_hotspot',
      observedAt: '2026-07-15T01:30:00.000Z',
      confidence: 'nominal',
    });
    expect(items[1]?.confidence).toBe('high');
    expect(items[1]?.payload.frpMw).toBe(12.2);
  });

  it('refuse un message d’erreur du service (clé invalide)', () => {
    expect(() => parseFirmsCsv('Invalid MAP_KEY.', 'VIIRS_SNPP_NRT')).toThrow(/inattendue/);
  });
});

describe('Open-Meteo (prévisions)', () => {
  const points = [{ id: '1501', name: 'Tizi Ouzou', lat: 36.71, lng: 4.05 }];
  it('utilise l’API commerciale uniquement si une clé est fournie', () => {
    expect(buildOpenMeteoUrl(points, null)).toContain('https://api.open-meteo.com/v1/forecast?');
    expect(buildOpenMeteoUrl(points, 'K')).toContain(
      'https://customer-api.open-meteo.com/v1/forecast?',
    );
    expect(buildOpenMeteoUrl(points, 'K')).toContain('apikey=K');
  });
  it('produit des signaux de prévision au-delà des seuils seulement', () => {
    const body = {
      hourly: {
        time: ['2026-07-15T12:00', '2026-07-15T13:00'],
        precipitation: [0, 2],
        wind_gusts_10m: [40, 95],
        temperature_2m: [41.5, 38],
      },
    };
    const items = parseOpenMeteo(body, points);
    expect(items.map((i) => i.payload.signal).sort()).toEqual(['heat', 'strong_wind']);
    expect(items.every((i) => i.kind === 'weather_forecast')).toBe(true);
  });
});

describe('HTTP : retry, backoff et disjoncteur', () => {
  it('retente sur 503 puis réussit', async () => {
    const fetchImpl = vi
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry(
      'https://example.test',
      {},
      { fetchImpl, sleep: async () => undefined },
    );
    expect(await res.text()).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('ne retente pas une erreur 401 (clé invalide)', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 401 }));
    await expect(
      fetchWithRetry('https://example.test', {}, { fetchImpl, sleep: async () => undefined }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('signale une erreur réseau après épuisement des tentatives', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      fetchWithRetry(
        'https://example.test',
        {},
        { fetchImpl, retries: 2, sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ status: null, retryable: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('borne le backoff exponentiel', () => {
    expect(backoffDelay(0, 500, 10000, () => 1)).toBe(500);
    expect(backoffDelay(10, 500, 10000, () => 1)).toBe(10000);
  });
  it('ouvre le disjoncteur après 5 échecs avec une pause croissante plafonnée', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    expect(circuitOpenUntil(4, now)).toBeNull();
    expect(circuitOpenUntil(5, now)?.toISOString()).toBe('2026-07-15T12:15:00.000Z');
    expect(circuitOpenUntil(6, now)?.toISOString()).toBe('2026-07-15T12:30:00.000Z');
    expect(circuitOpenUntil(20, now)?.toISOString()).toBe('2026-07-15T18:00:00.000Z');
  });
});
