import type { BBox, LatLng } from './geo';

export const APP_NAME = 'Tamurt Alerte';
export const APP_PUBLISHER = 'Tamurt Services';
export const APP_SLOGAN_FR = 'Veillons ensemble sur notre terre.';
/** Schéma d'URL profonde de l'application mobile. */
export const APP_SCHEME = 'tamurtalerte';

export interface CoverageRegion {
  id: string;
  /** Codes ONS des wilayas couvertes par le référentiel géographique. */
  wilayaCodes: readonly string[];
  /** Emprise des wilayas couvertes (calculée à partir des contours OSM importés). */
  bbox: BBox;
  /** Emprise élargie pour les sources externes (ex. séismes en mer au large des côtes). */
  sourceQueryBBox: BBox;
  center: LatLng;
  defaultZoom: number;
}

/**
 * Zone de lancement : Kabylie (wilayas de Tizi Ouzou, Béjaïa, Bouira, Boumerdès,
 * Bordj Bou Arréridj et Sétif). Conservée pour référence ; la couverture active est nationale.
 */
export const KABYLIE_REGION: CoverageRegion = {
  id: 'kabylie',
  wilayaCodes: ['15', '06', '10', '35', '34', '19'],
  bbox: [3.219, 35.615, 6.026, 36.924],
  sourceQueryBBox: [2.9, 35.3, 6.3, 37.5],
  center: { lat: 36.55, lng: 4.4 },
  defaultZoom: 8,
};

/**
 * Couverture nationale : les 69 wilayas d'Algérie (découpage administratif de 2025) et leurs
 * 1 538 communes, issues d'OpenStreetMap (paquet dz-geodata, ODbL). Emprise calculée sur les
 * contours importés ; l'emprise des sources externes déborde en mer pour les séismes au large.
 */
export const ALGERIA_REGION: CoverageRegion = {
  id: 'algerie',
  wilayaCodes: Array.from({ length: 69 }, (_, i) => String(i + 1).padStart(2, '0')),
  bbox: [-8.669, 18.968, 11.997, 37.09],
  sourceQueryBBox: [-9.2, 18.5, 12.3, 38.2],
  center: { lat: 28.2, lng: 2.6 },
  defaultZoom: 4.6,
};

export const DEFAULT_REGION = ALGERIA_REGION;

/** Limites anti-abus (appliquées aussi en base). */
export const LIMITS = {
  reportsPerHour: 5,
  reportsPerDay: 20,
  mediaPerReport: 3,
  mediaMaxBytes: 8 * 1024 * 1024,
  followedPlacesMax: 20,
  descriptionMaxLength: 2000,
  /** Délai pendant lequel l'auteur peut encore modifier un signalement en attente. */
  reportEditWindowMinutes: 30,
  assistancePostsPerDay: 3,
} as const;

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

/** Seuils de fraîcheur des données affichées (minutes). */
export const FRESHNESS_THRESHOLDS = {
  agingAfterMinutes: 15,
  staleAfterMinutes: 60,
} as const;

/** Fuseau horaire de référence du territoire initial. */
export const DEFAULT_TIMEZONE = 'Africa/Algiers';
