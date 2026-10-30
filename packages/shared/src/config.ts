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
 * Territoire initial : Kabylie. Le référentiel couvre les wilayas de Tizi Ouzou,
 * Béjaïa, Bouira, Boumerdès, Bordj Bou Arréridj et Sétif (communes issues d'OpenStreetMap).
 * L'extension à d'autres régions passe par l'import de nouvelles wilayas (scripts/geo).
 */
export const KABYLIE_REGION: CoverageRegion = {
  id: 'kabylie',
  wilayaCodes: ['15', '06', '10', '35', '34', '19'],
  bbox: [3.219, 35.615, 6.026, 36.924],
  sourceQueryBBox: [2.9, 35.3, 6.3, 37.5],
  center: { lat: 36.55, lng: 4.4 },
  defaultZoom: 8,
};

export const DEFAULT_REGION = KABYLIE_REGION;

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
