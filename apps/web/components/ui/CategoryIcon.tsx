import {
  Activity,
  Car,
  CloudLightning,
  Flame,
  HandHeart,
  TriangleAlert,
  Waves,
  Zap,
  type LucideProps,
} from 'lucide-react';
import { type CategoryId, type IconName, getCategory, isCategoryId } from '@tamurt/shared';

const ICONS: Record<IconName, React.ComponentType<LucideProps>> = {
  flame: Flame,
  waves: Waves,
  activity: Activity,
  'cloud-lightning': CloudLightning,
  car: Car,
  zap: Zap,
  'triangle-alert': TriangleAlert,
  'hand-heart': HandHeart,
};

export function CategoryIcon({
  categoryId,
  size = 20,
  withBackground = false,
}: {
  categoryId: CategoryId | string;
  size?: number;
  withBackground?: boolean;
}) {
  if (!isCategoryId(categoryId)) return null;
  const category = getCategory(categoryId);
  const Icon = ICONS[category.icon];
  if (!withBackground) return <Icon size={size} aria-hidden="true" color={category.color} />;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size + 16,
        height: size + 16,
        borderRadius: 999,
        background: category.color,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      <Icon size={size} />
    </span>
  );
}

export function iconSvgFor(icon: IconName): string {
  // Tracés Lucide simplifiés pour générer les marqueurs MapLibre (images SVG en data URL).
  const paths: Record<IconName, string> = {
    flame:
      '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7.5.5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    waves:
      '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'cloud-lightning':
      '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'triangle-alert':
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'hand-heart':
      '<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/>',
  };
  return paths[icon];
}
