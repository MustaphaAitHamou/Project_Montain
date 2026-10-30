import { type VerificationStatus, isUnverifiedStatus } from './statuses';

/** Provenance d'un événement. */
export const SOURCE_KINDS = [
  'community', // signalements d'utilisateurs
  'official', // autorité ou partenaire habilité
  'seismic', // réseau sismologique (ex. EMSC)
  'satellite', // observation satellite (ex. NASA FIRMS) — jamais un incendie confirmé à elle seule
  'forecast', // prévision météorologique (modèle) — distincte d'une vigilance officielle
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/**
 * Classe d'affichage sur la carte : permet de différencier visuellement
 * les signalements, les sources institutionnelles, les observations satellites
 * et les informations en cours de vérification.
 */
export type DisplayClass = 'unverified' | 'community' | 'institutional' | 'satellite' | 'forecast';

export function displayClassFor(sourceKind: SourceKind, status: VerificationStatus): DisplayClass {
  if (sourceKind === 'satellite') return 'satellite';
  if (sourceKind === 'forecast') return 'forecast';
  if (isUnverifiedStatus(status)) return 'unverified';
  if (sourceKind === 'official' || sourceKind === 'seismic') return 'institutional';
  return 'community';
}

/** Types d'observations externes stockées dans `external_observations`. */
export const OBSERVATION_KINDS = [
  'earthquake',
  'thermal_hotspot',
  'weather_forecast',
  'weather_warning',
] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

/** Identifiants des adaptateurs de sources externes. */
export const EXTERNAL_SOURCE_IDS = ['emsc', 'nasa_firms', 'open_meteo'] as const;
export type ExternalSourceId = (typeof EXTERNAL_SOURCE_IDS)[number];
