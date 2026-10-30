import type { Severity } from '../domain/severity';
import type { DisplayClass } from '../domain/sources';

/** Palette de marque Tamurt Alerte. */
export const brand = {
  forest: '#153D30',
  green: '#2D7B57',
  alertRed: '#C62828',
  vigilanceOrange: '#F59E0B',
  infoBlue: '#2563EB',
  white: '#FFFFFF',
  darkBg: '#101820',
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

export const lightColors: ThemeColors = {
  background: '#F5F7F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EAF1EE',
  border: '#C9D6D0',
  text: '#101820',
  textMuted: '#4A5A54',
  primary: brand.forest,
  primaryText: '#FFFFFF',
  accent: brand.green,
  focus: '#2563EB',
  danger: brand.alertRed,
  warning: '#B45309',
  info: brand.infoBlue,
  success: '#1E6B47',
  overlay: 'rgba(16, 24, 32, 0.55)',
};

export const darkColors: ThemeColors = {
  background: brand.darkBg,
  surface: '#17232D',
  surfaceAlt: '#1F2F3A',
  border: '#2E4250',
  text: '#F2F5F4',
  textMuted: '#A7B5BE',
  primary: brand.green,
  primaryText: '#FFFFFF',
  accent: '#56B587',
  focus: '#7FB0FF',
  danger: '#EF5350',
  warning: '#FBBF24',
  info: '#7FA7FF',
  success: '#56B587',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/**
 * Couleurs de gravité : fond + texte avec un contraste ≥ 4,5:1 (vérifié par test).
 * La couleur n'est jamais le seul indicateur : un libellé et une icône l'accompagnent.
 */
export const severityColors: Record<Severity, { background: string; text: string }> = {
  information: { background: brand.infoBlue, text: '#FFFFFF' },
  vigilance: { background: brand.vigilanceOrange, text: brand.darkBg },
  important: { background: '#EA580C', text: brand.darkBg },
  critical: { background: brand.alertRed, text: '#FFFFFF' },
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
export const radii = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
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
