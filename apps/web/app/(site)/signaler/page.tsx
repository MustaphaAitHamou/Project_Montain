import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';
import { requireUser } from '@/lib/auth';
import { ReportWizard } from '@/components/report/ReportWizard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('report.title') };
}

export default async function ReportPage() {
  const { t, locale } = await getI18n();
  const { user } = await requireUser('/signaler');
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 860 }}>
      <h1>{t('report.title')}</h1>
      <div className="banner banner-info" role="note">
        <p className="small">
          {t('report.intro')} {t('app.disclaimerEmergency')}
        </p>
      </div>
      {user.isSuspended ? (
        <div className="banner banner-danger" role="alert">
          <p>{t('errors.forbidden')}</p>
        </div>
      ) : (
        <ReportWizard locale={locale} userId={user.id} />
      )}
    </main>
  );
}
