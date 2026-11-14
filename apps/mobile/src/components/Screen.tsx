import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, radii, fontSizes } from '@tamurt/shared/theme';

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { colors } = useTheme();
  if (!scroll) {
    return <View style={[styles.flex, { backgroundColor: colors.background }]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.body, { color: muted ? colors.textMuted : colors.text }]}>{children}</Text>
  );
}

export function Banner({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) {
  const { colors } = useTheme();
  const border = {
    info: colors.info,
    warning: '#F8BA3C',
    danger: colors.danger,
    success: colors.success,
  }[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : 'text'}
      style={[styles.banner, { borderColor: border, backgroundColor: colors.surfaceAlt }]}
    >
      <Text style={[styles.body, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSizes.xl, fontWeight: '700' },
  body: { fontSize: fontSizes.md, lineHeight: 22 },
  banner: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
});
