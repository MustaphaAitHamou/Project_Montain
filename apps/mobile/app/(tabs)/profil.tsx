import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  FileText,
  Globe,
  LogOut,
  MapPin,
  Megaphone,
  Settings,
} from 'lucide-react-native';
import { LOCALES, LOCALE_INFO, type Locale } from '@tamurt/shared/i18n';
import { fontSizes, minTouchTarget, spacing } from '@tamurt/shared/theme';
import { Card, Screen, Title } from '@/components/Screen';
import { Button, Chip, Muted, Row, Subtitle } from '@/components/ui';
import { TranslationNotice } from '@/components/Banners';
import { useTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { usePreferences, type ThemePreference } from '@/lib/preferences';
import { supabase } from '@/lib/supabase';
import { clearPrivateCache } from '@/lib/cache';
import { unregisterPush } from '@/lib/push';
import { webUrl } from '@/lib/data';

function LinkRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.linkRow,
        { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.linkText, { color: colors.text }]}>{label}</Text>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfilScreen() {
  const { colors } = useTheme();
  const { t, tk } = useI18n();
  const { userId, email, roles } = useAuth();
  const { locale, setLocale, theme, setTheme } = usePreferences();
  const iconColor = colors.accent;

  const signOut = async () => {
    // Le jeton push de cet appareil est désactivé avant la déconnexion.
    await unregisterPush().catch(() => undefined);
    await supabase?.auth.signOut({ scope: 'local' });
    await clearPrivateCache();
  };

  const changeLocale = (l: Locale) => {
    setLocale(l);
    // Langue des notifications envoyées par le serveur.
    if (userId) void supabase?.from('profiles').update({ preferred_locale: l }).eq('id', userId);
  };

  const themes: {
    value: ThemePreference;
    key: 'profile.themeLight' | 'profile.themeDark' | 'profile.themeSystem';
  }[] = [
    { value: 'system', key: 'profile.themeSystem' },
    { value: 'light', key: 'profile.themeLight' },
    { value: 'dark', key: 'profile.themeDark' },
  ];

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>
      {userId ? (
        <Card>
          <Subtitle>{t('profile.account')}</Subtitle>
          <Muted>{t('profile.email')}</Muted>
          <Text style={{ color: colors.text, fontSize: fontSizes.md }}>{email}</Text>
          <Muted>
            {t('profile.roles')} :{' '}
            {roles.length > 0 ? roles.map((r) => tk(`role.${r}`)).join(', ') : t('role.user')}
          </Muted>
        </Card>
      ) : (
        <Card>
          <Subtitle>{t('profile.visitorTitle')}</Subtitle>
          <Text style={{ color: colors.text }}>{t('profile.visitorBody')}</Text>
          <Button label={t('common.signIn')} onPress={() => router.push('/connexion')} />
          <Button
            variant="outline"
            label={t('common.signUp')}
            onPress={() => router.push('/inscription')}
          />
        </Card>
      )}

      <View>
        <LinkRow
          label={t('nav.villages')}
          icon={<MapPin size={20} color={iconColor} />}
          onPress={() => router.push('/villages')}
        />
        <LinkRow
          label={t('nav.notifications')}
          icon={<Bell size={20} color={iconColor} />}
          onPress={() => router.push('/notifications')}
        />
        <LinkRow
          label={t('notifications.preferences')}
          icon={<Settings size={20} color={iconColor} />}
          onPress={() => router.push('/notifications/preferences')}
        />
        <LinkRow
          label={t('report.myReports')}
          icon={<Megaphone size={20} color={iconColor} />}
          onPress={() => router.push('/signalements')}
        />
        <LinkRow
          label={t('home.sourcesTitle')}
          icon={<Globe size={20} color={iconColor} />}
          onPress={() => router.push('/sources')}
        />
      </View>

      <Card>
        <Subtitle>{t('profile.language')}</Subtitle>
        <Row>
          {LOCALES.map((l) => (
            <Chip
              key={l}
              label={LOCALE_INFO[l].nativeName}
              selected={locale === l}
              onPress={() => changeLocale(l)}
            />
          ))}
        </Row>
        <TranslationNotice />
        <Subtitle>{t('profile.theme')}</Subtitle>
        <Row>
          {themes.map((th) => (
            <Chip
              key={th.value}
              label={t(th.key)}
              selected={theme === th.value}
              onPress={() => setTheme(th.value)}
            />
          ))}
        </Row>
      </Card>

      <Card>
        <Subtitle>{t('profile.myData')}</Subtitle>
        <Muted>{t('mobile.manageOnWeb')}</Muted>
        <Button
          variant="outline"
          label={t('mobile.openWebsite')}
          onPress={() => void Linking.openURL(webUrl('/profil'))}
        />
      </Card>

      <View>
        <LinkRow
          label={t('nav.safety')}
          icon={<FileText size={20} color={iconColor} />}
          onPress={() => void Linking.openURL(webUrl('/consignes'))}
        />
        <LinkRow
          label={t('nav.privacy')}
          icon={<FileText size={20} color={iconColor} />}
          onPress={() => void Linking.openURL(webUrl('/confidentialite'))}
        />
        <LinkRow
          label={t('nav.terms')}
          icon={<FileText size={20} color={iconColor} />}
          onPress={() => void Linking.openURL(webUrl('/conditions'))}
        />
        <LinkRow
          label={t('nav.about')}
          icon={<FileText size={20} color={iconColor} />}
          onPress={() => void Linking.openURL(webUrl('/a-propos'))}
        />
      </View>

      {userId ? (
        <Button
          variant="outline"
          label={t('common.signOut')}
          icon={<LogOut size={18} color={colors.text} />}
          onPress={() => void signOut()}
        />
      ) : null}
      <Muted>
        {t('app.name')} · {t('app.publisher')}
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkText: { flex: 1, fontSize: fontSizes.md },
});
