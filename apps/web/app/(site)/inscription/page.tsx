import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { SignUpForm } from '@/components/auth/AuthForms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('auth.signUpTitle') };
}

export default async function SignUpPage() {
  const { t, locale } = await getI18n();
  const { user } = await getSession();
  if (user) redirect('/profil');
  return (
    <main className="page container" id="contenu" style={{ maxWidth: 520 }}>
      <div className="card stack">
        <h1>{t('auth.signUpTitle')}</h1>
        <p className="small muted">{t('app.disclaimerShort')}</p>
        <SignUpForm locale={locale} />
      </div>
    </main>
  );
}
