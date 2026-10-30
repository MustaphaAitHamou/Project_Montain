import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { fontSizes, minTouchTarget, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'outline' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const background = {
    primary: colors.primary,
    outline: 'transparent',
    danger: colors.danger,
    ghost: 'transparent',
  }[variant];
  const foreground =
    variant === 'primary' || variant === 'danger' ? colors.primaryText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'outline' ? colors.border : background,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  help,
  error,
  ...props
}: TextInputProps & { label: string; help?: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={help}
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[
          styles.input,
          props.multiline && styles.multiline,
          {
            color: colors.text,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />
      {help ? <Text style={[styles.small, { color: colors.textMuted }]}>{help}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.small, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={help}
      onPress={() => onChange(!checked)}
      style={styles.choiceRow}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.accent : colors.border,
            backgroundColor: checked ? colors.accent : 'transparent',
          },
        ]}
      >
        {checked ? <Check size={16} color={colors.primaryText} /> : null}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.body, { color: colors.text }]}>{label}</Text>
        {help ? <Text style={[styles.small, { color: colors.textMuted }]}>{help}</Text> : null}
      </View>
    </Pressable>
  );
}

export function RadioRow({
  label,
  selected,
  onPress,
  icon,
  description,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
  description?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.radio,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.surfaceAlt : colors.surface,
        },
      ]}
    >
      {icon}
      <View style={styles.flex}>
        <Text style={[styles.body, { color: colors.text, fontWeight: selected ? '700' : '400' }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.small, { color: colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <View style={[styles.dot, { borderColor: selected ? colors.accent : colors.border }]}>
        {selected ? <View style={[styles.dotInner, { backgroundColor: colors.accent }]} /> : null}
      </View>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accent : colors.surface,
        },
      ]}
    >
      <Text
        style={[
          styles.small,
          { color: selected ? colors.primaryText : colors.text, fontWeight: '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.small, { color: colors.textMuted }]}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.subtitle, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>
      {children}
    </Text>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Loading({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[styles.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: {
    minHeight: minTouchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: { fontSize: fontSizes.md, fontWeight: '700' },
  field: { gap: spacing.xs },
  label: { fontSize: fontSizes.sm, fontWeight: '600' },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.md,
  },
  multiline: { minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' },
  small: { fontSize: fontSizes.sm, lineHeight: 20 },
  body: { fontSize: fontSizes.md, lineHeight: 22 },
  subtitle: { fontSize: fontSizes.lg, fontWeight: '700' },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.xs,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: minTouchTarget,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  loading: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
});
