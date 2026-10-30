import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getI18n } from '@/lib/i18n';
import { getSession, safeNextPath } from '@/lib/auth';
import { SignInForm } from '@/components/auth/AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('auth.signInTitle') };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (user) redirect(next);
  return (
    <main className="page container" id="contenu" style={{ maxWidth: 480 }}>
      <div className="card stack">
        <h1>{t('auth.signInTitle')}</h1>
        {params.erreur === 'lien' && (
          <div className="banner banner-danger" role="alert">
            <p>{t('auth.linkInvalid')}</p>
          </div>
        )}
        <SignInForm locale={locale} next={next} />
      </div>
    </main>
  );
}
