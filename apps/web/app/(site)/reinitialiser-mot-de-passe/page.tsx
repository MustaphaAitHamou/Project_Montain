import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { ResetPasswordForm } from '@/components/auth/AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('auth.resetTitle') };
}

export default async function ResetPasswordPage() {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  return (
    <main className="page container" id="contenu" style={{ maxWidth: 480 }}>
      <div className="card stack">
        <h1>{t('auth.resetTitle')}</h1>
        {user ? (
          <ResetPasswordForm locale={locale} />
        ) : (
          <>
            <div className="banner banner-danger" role="alert">
              <p>{t('auth.linkInvalid')}</p>
            </div>
            <Link href="/mot-de-passe-oublie">{t('auth.forgotPassword')}</Link>
          </>
        )}
      </div>
    </main>
  );
}
