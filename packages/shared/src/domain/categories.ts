import type { Severity } from './severity';
import type { VerificationStatus } from './statuses';

/**
 * Catalogue des catégories d'alertes. C'est la source de vérité côté code ;
 * la table `alert_categories` / `alert_subcategories` est alimentée avec les mêmes
 * identifiants (un test d'intégration vérifie la cohérence).
 */
export const CATEGORY_IDS = [
  'fire',
  'flood',
  'earthquake',
  'weather',
  'traffic',
  'utilities',
  'local_hazard',
  'mutual_aid',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Noms d'icônes (jeu Lucide, licence ISC), résolus par chaque application. */
export type IconName =
  | 'flame'
  | 'waves'
  | 'activity'
  | 'cloud-lightning'
  | 'car'
  | 'zap'
  | 'triangle-alert'
  | 'hand-heart';

export interface SubcategoryDefinition {
  /** Identifiant stable « categorie.sous_categorie ». */
  id: string;
  categoryId: CategoryId;
  /** Sélectionnable par un utilisateur dans le formulaire de signalement. */
  reportable: boolean;
  /** Gravité proposée par défaut (toujours plafonnée selon le statut de vérification). */
  defaultSeverity: Severity;
}

export interface CategoryValidationRules {
  minDescriptionLength: number;
  /** Ancienneté maximale de l'heure observée déclarée. */
  maxObservedAgeHours: number;
  photoRecommended: boolean;
  /** Le phénomène peut être localisé de façon approximative ou incertaine (ex. fumée au loin). */
  allowUncertainLocation: boolean;
}

export interface CategoryNotificationRules {
  /** Peut déclencher des notifications push. */
  notifiable: boolean;
  /** Statut minimal requis pour pousser une notification par défaut. */
  minStatusForPush: VerificationStatus;
  /** Fenêtre et rayon utilisés pour détecter les doublons de signalements. */
  dedupWindowMinutes: number;
  dedupRadiusMeters: number;
}

export interface CategoryDefinition {
  id: CategoryId;
  icon: IconName;
  /** Couleur de la catégorie (marqueurs, puces). Toujours accompagnée d'un libellé. */
  color: string;
  /** 1 = priorité la plus haute. */
  priority: 1 | 2 | 3 | 4 | 5;
  /** `assistance` : traité par l'espace Entraide et non comme une alerte. */
  module: 'alerts' | 'assistance';
  subcategories: readonly SubcategoryDefinition[];
  validation: CategoryValidationRules;
  notification: CategoryNotificationRules;
}

function sub(
  categoryId: CategoryId,
  key: string,
  defaultSeverity: Severity,
  reportable = true,
): SubcategoryDefinition {
  return { id: `${categoryId}.${key}`, categoryId, reportable, defaultSeverity };
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  {
    id: 'fire',
    icon: 'flame',
    color: '#D84315',
    priority: 1,
    module: 'alerts',
    subcategories: [
      sub('fire', 'smoke', 'vigilance'),
      sub('fire', 'suspected_start', 'vigilance'),
      sub('fire', 'spread_documented', 'important'),
      // Réservés aux modérateurs et sources habilitées :
      sub('fire', 'confirmed', 'important', false),
      sub('fire', 'ended', 'information', false),
    ],
    validation: {
      minDescriptionLength: 10,
      maxObservedAgeHours: 24,
      photoRecommended: true,
      allowUncertainLocation: true,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'under_review',
      dedupWindowMinutes: 180,
      dedupRadiusMeters: 3000,
    },
  },
  {
    id: 'flood',
    icon: 'waves',
    color: '#0277BD',
    priority: 1,
    module: 'alerts',
    subcategories: [
      sub('flood', 'flooding', 'vigilance'),
      sub('flood', 'submerged_road', 'vigilance'),
      sub('flood', 'overflow', 'vigilance'),
      sub('flood', 'dangerous_rain', 'vigilance'),
      sub('flood', 'landslide', 'important'),
    ],
    validation: {
      minDescriptionLength: 10,
      maxObservedAgeHours: 24,
      photoRecommended: true,
      allowUncertainLocation: true,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'under_review',
      dedupWindowMinutes: 240,
      dedupRadiusMeters: 2000,
    },
  },
  {
    id: 'earthquake',
    icon: 'activity',
    color: '#6D4C41',
    priority: 1,
    module: 'alerts',
    subcategories: [
      sub('earthquake', 'felt', 'information'),
      sub('earthquake', 'damage', 'important'),
      // Alimenté uniquement par les sources sismologiques (EMSC) :
      sub('earthquake', 'recorded', 'information', false),
    ],
    validation: {
      minDescriptionLength: 5,
      maxObservedAgeHours: 12,
      photoRecommended: false,
      allowUncertainLocation: true,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'confirmed',
      dedupWindowMinutes: 60,
      dedupRadiusMeters: 30000,
    },
  },
  {
    id: 'weather',
    icon: 'cloud-lightning',
    color: '#5E35B1',
    priority: 2,
    module: 'alerts',
    subcategories: [
      sub('weather', 'thunderstorm', 'vigilance'),
      sub('weather', 'snow', 'vigilance'),
      sub('weather', 'strong_wind', 'vigilance'),
      sub('weather', 'heatwave', 'vigilance'),
      sub('weather', 'frost', 'information'),
      sub('weather', 'heavy_precipitation', 'vigilance'),
    ],
    validation: {
      minDescriptionLength: 5,
      maxObservedAgeHours: 12,
      photoRecommended: false,
      allowUncertainLocation: true,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'corroborated',
      dedupWindowMinutes: 360,
      dedupRadiusMeters: 10000,
    },
  },
  {
    id: 'traffic',
    icon: 'car',
    color: '#B26A00',
    priority: 3,
    module: 'alerts',
    subcategories: [
      sub('traffic', 'accident', 'vigilance'),
      sub('traffic', 'road_closed', 'vigilance'),
      sub('traffic', 'rockfall', 'vigilance'),
      sub('traffic', 'obstacle', 'information'),
      sub('traffic', 'bridge_impassable', 'important'),
      sub('traffic', 'snow_on_road', 'vigilance'),
    ],
    validation: {
      minDescriptionLength: 10,
      maxObservedAgeHours: 12,
      photoRecommended: true,
      allowUncertainLocation: false,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'corroborated',
      dedupWindowMinutes: 120,
      dedupRadiusMeters: 500,
    },
  },
  {
    id: 'utilities',
    icon: 'zap',
    color: '#00838F',
    priority: 4,
    module: 'alerts',
    subcategories: [
      sub('utilities', 'water_outage', 'information'),
      sub('utilities', 'power_outage', 'information'),
      sub('utilities', 'network_outage', 'information'),
      sub('utilities', 'transport_interruption', 'information'),
      sub('utilities', 'service_unavailable', 'information'),
    ],
    validation: {
      minDescriptionLength: 10,
      maxObservedAgeHours: 48,
      photoRecommended: false,
      allowUncertainLocation: false,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'corroborated',
      dedupWindowMinutes: 720,
      dedupRadiusMeters: 3000,
    },
  },
  {
    id: 'local_hazard',
    icon: 'triangle-alert',
    color: '#AD1457',
    priority: 2,
    module: 'alerts',
    subcategories: [
      sub('local_hazard', 'power_line', 'vigilance'),
      sub('local_hazard', 'building_collapse', 'vigilance'),
      sub('local_hazard', 'pollution', 'vigilance'),
      sub('local_hazard', 'other', 'information'),
    ],
    validation: {
      minDescriptionLength: 15,
      maxObservedAgeHours: 72,
      photoRecommended: true,
      allowUncertainLocation: false,
    },
    notification: {
      notifiable: true,
      minStatusForPush: 'corroborated',
      dedupWindowMinutes: 1440,
      dedupRadiusMeters: 300,
    },
  },
  {
    id: 'mutual_aid',
    icon: 'hand-heart',
    color: '#2D7B57',
    priority: 5,
    module: 'assistance',
    subcategories: [
      sub('mutual_aid', 'assistance_needed', 'information'),
      sub('mutual_aid', 'material_distribution', 'information'),
      sub('mutual_aid', 'volunteers_needed', 'information'),
      sub('mutual_aid', 'logistics', 'information'),
    ],
    validation: {
      minDescriptionLength: 20,
      maxObservedAgeHours: 168,
      photoRecommended: false,
      allowUncertainLocation: false,
    },
    notification: {
      notifiable: false,
      minStatusForPush: 'confirmed',
      dedupWindowMinutes: 1440,
      dedupRadiusMeters: 1000,
    },
  },
];

const CATEGORY_MAP = new Map<CategoryId, CategoryDefinition>(CATEGORIES.map((c) => [c.id, c]));
const SUBCATEGORY_MAP = new Map<string, SubcategoryDefinition>(
  CATEGORIES.flatMap((c) => c.subcategories.map((s) => [s.id, s] as const)),
);

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function getCategory(id: CategoryId): CategoryDefinition {
  const category = CATEGORY_MAP.get(id);
  if (!category) throw new Error(`Catégorie inconnue : ${id}`);
  return category;
}

export function findSubcategory(id: string): SubcategoryDefinition | undefined {
  return SUBCATEGORY_MAP.get(id);
}

/** Catégories proposées dans le formulaire de signalement d'alerte. */
export function reportableAlertCategories(): CategoryDefinition[] {
  return CATEGORIES.filter((c) => c.module === 'alerts');
}

export function reportableSubcategories(categoryId: CategoryId): SubcategoryDefinition[] {
  return getCategory(categoryId).subcategories.filter((s) => s.reportable);
}

export function subcategoryKey(subcategoryId: string): string {
  const dot = subcategoryId.indexOf('.');
  return dot === -1 ? subcategoryId : subcategoryId.slice(dot + 1);
}
