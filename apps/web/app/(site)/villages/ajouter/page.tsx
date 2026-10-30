import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';
import { requireUser } from '@/lib/auth';
import { AddPlaceForm } from '@/components/villages/AddPlaceForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('villages.add') };
}

export default async function AddVillagePage() {
  const { t, locale } = await getI18n();
  await requireUser('/villages/ajouter');
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 860 }}>
      <h1>{t('villages.add')}</h1>
      <p className="muted">{t('villages.intro')}</p>
      <div className="card">
        <AddPlaceForm locale={locale} />
      </div>
    </main>
  );
}
