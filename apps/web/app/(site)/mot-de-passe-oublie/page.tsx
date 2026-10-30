import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';
import { ForgotPasswordForm } from '@/components/auth/AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('auth.resetTitle') };
}

export default async function ForgotPasswordPage() {
  const { t, locale } = await getI18n();
  return (
    <main className="page container" id="contenu" style={{ maxWidth: 480 }}>
      <div className="card stack">
        <h1>{t('auth.resetTitle')}</h1>
        <ForgotPasswordForm locale={locale} />
      </div>
    </main>
  );
}
