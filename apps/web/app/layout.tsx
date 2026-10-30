import type { Metadata, Viewport } from 'next';
import { Noto_Sans, Noto_Sans_Arabic } from 'next/font/google';
import { getI18n, getThemePreference } from '@/lib/i18n';
import './globals.css';

// Polices auto-hébergées par Next.js au build (aucune requête vers Google côté visiteur).
const notoSans = Noto_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-noto',
  display: 'swap',
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
    { media: '(prefers-color-scheme: light)', color: '#153D30' },
    { media: '(prefers-color-scheme: dark)', color: '#101820' },
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
      className={`${notoSans.variable} ${notoSansArabic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
