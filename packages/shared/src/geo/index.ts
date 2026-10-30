export interface LatLng {
  lat: number;
  lng: number;
}

/** [ouest, sud, est, nord] en degrés WGS84. */
export type BBox = readonly [number, number, number, number];

const EARTH_RADIUS_M = 6_371_008.8;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance orthodromique (formule de haversine), en mètres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLng(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

export function isWithinBBox(p: LatLng, bbox: BBox): boolean {
  const [west, south, east, north] = bbox;
  return p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north;
}

export function expandBBox(bbox: BBox, marginDeg: number): BBox {
  const [west, south, east, north] = bbox;
  return [west - marginDeg, south - marginDeg, east + marginDeg, north + marginDeg];
}

export function bboxToString(bbox: BBox, precision = 4): string {
  return bbox.map((v) => v.toFixed(precision)).join(',');
}

/**
 * Arrondit une position pour la diffusion publique (ex. espace Entraide) afin
 * de ne jamais exposer la localisation précise d'une personne.
 * 2 décimales ≈ 1,1 km en latitude.
 */
export function coarsenLocation(p: LatLng, decimals = 2): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}

export function formatDistance(meters: number, locale = 'fr'): string {
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} m`;
  }
  const km = meters / 1000;
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 });
  return `${formatter.format(km)} km`;
}

/** Rayons proposés pour la surveillance d'un village (mètres). */
export const WATCH_RADIUS_OPTIONS_M = [1000, 2000, 5000, 10000, 20000] as const;
export const WATCH_RADIUS_MIN_M = 500;
export const WATCH_RADIUS_MAX_M = 30000;
export const WATCH_RADIUS_DEFAULT_M = 5000;

/** Polygone GeoJSON approchant un cercle géodésique (rayon de surveillance ou d'incertitude). */
export function circlePolygon(
  center: LatLng,
  radiusMeters: number,
  steps = 64,
): { type: 'Polygon'; coordinates: [number, number][][] } {
  const earthRadius = 6_371_008.8;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const angular = radiusMeters / earthRadius;
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
      );
    coordinates.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: 'Polygon', coordinates: [coordinates] };
}
