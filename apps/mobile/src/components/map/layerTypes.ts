import type { LayerProps } from '@maplibre/maplibre-react-native';
import { CATEGORIES } from '@tamurt/shared';
import { displayClassStyles } from '@tamurt/shared/theme';

type SpecLayer<T extends string> = Extract<LayerProps, { type: T; paint?: unknown }>;
export type CirclePaint = NonNullable<SpecLayer<'circle'>['paint']>;
export type FillPaint = NonNullable<SpecLayer<'fill'>['paint']>;
export type LinePaint = NonNullable<SpecLayer<'line'>['paint']>;
export type Filter = NonNullable<SpecLayer<'circle'>['filter']>;

type Expression = (string | number | boolean | Expression)[];
/** Les expressions sont construites à partir du catalogue partagé : on les type une fois ici. */
const asColor = (e: Expression) => e as unknown as CirclePaint['circle-color'];
const asNumber = (e: Expression) => e as unknown as CirclePaint['circle-radius'];

export const categoryColor = asColor([
  'match',
  ['get', 'category'],
  ...CATEGORIES.flatMap((c) => [c.id, c.color]),
  '#4A5A54',
]);

export const severityRadius = asNumber([
  'match',
  ['get', 'severity'],
  'critical',
  11,
  'important',
  10,
  'vigilance',
  9,
  8,
]);

const classes = Object.entries(displayClassStyles);
export const displayStroke = asColor([
  'match',
  ['get', 'displayClass'],
  ...classes.flatMap(([k, v]) => [k, v.strokeColor]),
  '#FFFFFF',
]);
export const displayStrokeWidth = asNumber([
  'match',
  ['get', 'displayClass'],
  ...classes.flatMap(([k, v]) => [k, v.strokeWidth]),
  2,
]);
export const displayOpacity = asNumber([
  'match',
  ['get', 'displayClass'],
  ...classes.flatMap(([k, v]) => [k, v.opacity]),
  1,
]);

export const clusterRadius = asNumber(['step', ['get', 'point_count'], 16, 10, 20, 50, 26]);

export const isCluster = ['has', 'point_count'] as unknown as Filter;
export const isPoint = ['!', ['has', 'point_count']] as unknown as Filter;
