import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('offline.title') };
}

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 560 }}>
      <h1>{t('offline.title')}</h1>
      <p>{t('offline.body')}</p>
      <div className="banner banner-warning" role="note">
        <p>{t('offline.notAnAlertSystem')}</p>
      </div>
      <p>{t('app.disclaimerEmergency')}</p>
    </main>
  );
}
