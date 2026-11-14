import type { Severity } from '../domain/severity';
import type { DisplayClass } from '../domain/sources';

/**
 * Palette de marque Tamurt Alerte (DA Tamurt Services) : rouge signal, blanc et noir.
 * Le rouge marque la barre, le bandeau et les actions, jamais un écran entier.
 */
export const brand = {
  signalRed: '#D9261C',
  signalRedDeep: '#8F130B',
  signalRedVif: '#F03A2A',
  black: '#111111',
  white: '#FFFFFF',
  ink: '#1D1B19',
  darkBg: '#141312',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string;
  focus: string;
  danger: string;
  warning: string;
  info: string;
  success: string;
  overlay: string;
}

/** Neutres chauds communs à la famille Tamurt ; rouge signal pour les actions ; statuts de la DA. */
export const lightColors: ThemeColors = {
  background: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EBE9E4',
  border: '#DEDBD4',
  text: brand.ink,
  textMuted: '#5C5852',
  primary: brand.signalRed,
  primaryText: '#FFFFFF',
  accent: '#C41E14',
  focus: brand.ink,
  danger: '#B8261A',
  warning: '#8A5300',
  info: '#1F58B0',
  success: '#0B6E5B',
  overlay: 'rgba(29, 27, 25, 0.55)',
};

export const darkColors: ThemeColors = {
  background: brand.darkBg,
  surface: '#1F1D1B',
  surfaceAlt: '#2A2724',
  border: '#35322E',
  text: '#F4F1EC',
  textMuted: '#B5AFA6',
  primary: brand.signalRed,
  primaryText: '#FFFFFF',
  accent: '#FF6B5E',
  focus: '#F4F1EC',
  danger: '#FF8F85',
  warning: '#F8BA3C',
  info: '#8FB6F5',
  success: '#5FD3BB',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/**
 * Couleurs de gravité : fond + texte avec un contraste ≥ 4,5:1 (vérifié par test).
 * Mêmes niveaux que la DA Tamurt Services : information (bleu), vigilance (ambre),
 * important (orange du niveau « alerte »), critique (rouge danger, réservé au dernier niveau).
 * La couleur n'est jamais le seul indicateur : un libellé et une icône l'accompagnent.
 */
export const severityColors: Record<Severity, { background: string; text: string }> = {
  information: { background: '#1F58B0', text: '#FFFFFF' },
  vigilance: { background: '#F8BA3C', text: brand.black },
  important: { background: '#B33A08', text: '#FFFFFF' },
  critical: { background: '#B8261A', text: '#FFFFFF' },
};

/** Style de marqueur cartographique selon la provenance / le niveau de vérification. */
export const displayClassStyles: Record<
  DisplayClass,
  { strokeColor: string; strokeWidth: number; opacity: number; dashed: boolean }
> = {
  unverified: { strokeColor: '#F59E0B', strokeWidth: 3, opacity: 0.75, dashed: true },
  community: { strokeColor: '#FFFFFF', strokeWidth: 2, opacity: 1, dashed: false },
  institutional: { strokeColor: '#101820', strokeWidth: 3, opacity: 1, dashed: false },
  satellite: { strokeColor: '#7C2D12', strokeWidth: 2, opacity: 0.9, dashed: false },
  forecast: { strokeColor: '#5E35B1', strokeWidth: 2, opacity: 0.8, dashed: true },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Coins francs de la DA Alerte (panneaux) : 2 px partout, pilule réservée aux pastilles. */
export const radii = { sm: 2, md: 2, lg: 2, pill: 999 } as const;
export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;
/** Taille minimale des cibles tactiles (WCAG 2.5.5 / recommandations iOS et Android). */
export const minTouchTarget = 44;

/** Luminance relative WCAG 2.x d'une couleur hexadécimale #RRGGBB. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
