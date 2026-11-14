import { StyleSheet, Text, View } from 'react-native';
import {
  CircleCheck,
  CircleDashed,
  Satellite,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import {
  type DisplayClass,
  type Severity,
  type SourceKind,
  type VerificationStatus,
  displayClassFor,
  isUnverifiedStatus,
} from '@tamurt/shared';
import { fontSizes, radii, severityColors, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';

function Badge({
  label,
  background,
  color,
  borderColor,
  Icon,
  dashed = false,
}: {
  label: string;
  background: string;
  color: string;
  borderColor?: string;
  Icon?: LucideIcon;
  dashed?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: background,
          borderColor: borderColor ?? background,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
      ]}
    >
      {Icon ? <Icon size={14} color={color} /> : <Text style={{ color }}>●</Text>}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { tk } = useI18n();
  const c = severityColors[severity];
  return <Badge label={tk(`severity.${severity}`)} background={c.background} color={c.text} />;
}

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const { tk } = useI18n();
  const { colors } = useTheme();
  const unverified = isUnverifiedStatus(status);
  return (
    <Badge
      label={tk(`status.${status}`)}
      background={colors.surfaceAlt}
      color={colors.text}
      borderColor={unverified ? '#F8BA3C' : colors.border}
      dashed={unverified}
      Icon={unverified ? CircleDashed : CircleCheck}
    />
  );
}

const DISPLAY_ICONS: Record<DisplayClass, LucideIcon> = {
  unverified: CircleDashed,
  community: Users,
  institutional: ShieldCheck,
  satellite: Satellite,
  forecast: CircleDashed,
};

/** Provenance de l'information (le statut de vérification est porté par StatusBadge). */
export function SourceBadge({
  sourceKind,
  status,
}: {
  sourceKind: SourceKind;
  status: VerificationStatus;
}) {
  const { tk } = useI18n();
  const { colors } = useTheme();
  const displayClass = displayClassFor(sourceKind, status);
  const shown =
    displayClass === 'unverified'
      ? sourceKind === 'community'
        ? 'community'
        : 'institutional'
      : displayClass;
  const label =
    displayClass === 'unverified'
      ? tk(`sourceKind.${sourceKind}`)
      : tk(`displayClass.${displayClass}`);
  return (
    <Badge
      label={label}
      background={colors.surface}
      color={colors.text}
      borderColor={colors.border}
      Icon={DISPLAY_ICONS[shown]}
    />
  );
}

export function DemoBadge() {
  const { t } = useI18n();
  return <Badge label={t('demo.badge')} background="#5E35B1" color="#FFFFFF" />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSizes.xs, fontWeight: '700' },
});
