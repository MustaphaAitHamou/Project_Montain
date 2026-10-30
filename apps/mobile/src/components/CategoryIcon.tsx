import {
  Activity,
  Car,
  CloudLightning,
  Flame,
  HandHeart,
  TriangleAlert,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { type CategoryId, type IconName, getCategory } from '@tamurt/shared';

const ICONS: Record<IconName, LucideIcon> = {
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
  color,
}: {
  categoryId: CategoryId;
  size?: number;
  color?: string;
}) {
  const category = getCategory(categoryId);
  const Icon = ICONS[category.icon];
  return (
    <Icon
      size={size}
      color={color ?? category.color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
