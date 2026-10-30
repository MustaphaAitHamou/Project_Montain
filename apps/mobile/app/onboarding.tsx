import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Lock, ShieldAlert, Users } from 'lucide-react-native';
import { LOCALES, LOCALE_INFO } from '@tamurt/shared/i18n';
import { fontSizes, radii, spacing } from '@tamurt/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences';
import { Button, Chip, Row } from '@/components/ui';
import { TranslationNotice } from '@/components/Banners';

const SLIDES = [
  { icon: Users, title: 'onboarding.welcomeTitle', body: 'onboarding.welcomeBody' },
  { icon: ShieldAlert, title: 'onboarding.notOfficialTitle', body: 'onboarding.notOfficialBody' },
  { icon: Bell, title: 'onboarding.villagesTitle', body: 'onboarding.villagesBody' },
  { icon: Lock, title: 'onboarding.privacyTitle', body: 'onboarding.privacyBody' },
] as const;

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { locale, setLocale, completeOnboarding } = usePreferences();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0];
  const Icon = slide.icon;
  const last = index === SLIDES.length - 1;

  const finish = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {index === 0 ? (
          <Row>
            {LOCALES.map((l) => (
              <Chip
                key={l}
                label={LOCALE_INFO[l].nativeName}
                selected={locale === l}
                onPress={() => setLocale(l)}
              />
            ))}
          </Row>
        ) : null}
        <TranslationNotice />
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Icon size={48} color={colors.accent} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {t(slide.title)}
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>{t(slide.body)}</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.step, { color: colors.textMuted }]}>
          {index + 1} / {SLIDES.length}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button variant="ghost" label={t('onboarding.skip')} onPress={finish} />
        <Button
          label={last ? t('onboarding.start') : t('common.next')}
          onPress={() => (last ? finish() : setIndex(index + 1))}
          style={styles.grow}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  title: { fontSize: fontSizes.xxl, fontWeight: '800' },
  body: { fontSize: fontSizes.md, lineHeight: 24 },
  step: { textAlign: 'center', fontSize: fontSizes.sm },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.xl },
  grow: { flex: 1 },
});
