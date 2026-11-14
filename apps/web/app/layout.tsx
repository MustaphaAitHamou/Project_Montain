import type { Metadata, Viewport } from 'next';
import { Anton, Inter_Tight, Noto_Sans_Arabic } from 'next/font/google';
import { getI18n, getThemePreference } from '@/lib/i18n';
import './globals.css';

// Polices auto-hébergées par Next.js au build (aucune requête vers Google côté visiteur).
// DA Tamurt Services : Anton (capitale étroite et grasse) pour les titres, niveaux et boutons,
// Inter Tight pour les consignes et le texte. Les deux couvrent les lettres kabyles (ɛ, ɣ, ḍ…).
// Pas de police de repli ajustée : l'arabe passe directement à Noto Sans Arabic.
const anton = Anton({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
  adjustFontFallback: false,
});
const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter-tight',
  display: 'swap',
  adjustFontFallback: false,
});
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t('app.name'), template: `%s · ${t('app.name')}` },
    description: `${t('app.slogan')} ${t('app.disclaimerShort')}`,
    applicationName: t('app.name'),
    manifest: '/manifest.webmanifest',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F5F2' },
    { media: '(prefers-color-scheme: dark)', color: '#141312' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getI18n();
  const theme = await getThemePreference();
  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme === 'system' ? undefined : theme}
      className={`${anton.variable} ${interTight.variable} ${notoSansArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
