import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, Download, FileText, LogOut, MapPinned, ShieldCheck } from 'lucide-react';
import type { Locale } from '@tamurt/shared/i18n';
import { getI18n, getThemePreference } from '@/lib/i18n';
import { getSession, isStaff } from '@/lib/auth';
import { signOutAction, signOutEverywhereAction } from '@/app/actions/auth';
import { DeleteAccountForm, ProfileForm } from '@/components/profile/ProfileForms';
import { PreferenceControls } from '@/components/layout/PreferenceControls';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('profile.title') };
}

export default async function ProfilePage() {
  const { t, tk, locale } = await getI18n();
  const theme = await getThemePreference();
  const { user } = await getSession();
  const preferences = (
    <section className="card stack-sm" aria-labelledby="prefs-title">
      <h2 id="prefs-title">{t('nav.settings')}</h2>
      <PreferenceControls
        locale={locale}
        theme={theme}
        labels={{
          language: t('common.language'),
          theme: t('common.theme'),
          light: t('profile.themeLight'),
          dark: t('profile.themeDark'),
          system: t('profile.themeSystem'),
          apply: t('common.apply'),
        }}
      />
    </section>
  );

  if (!user) {
    return (
      <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
        <h1>{t('profile.title')}</h1>
        <section className="card stack-sm">
          <h2>{t('profile.visitorTitle')}</h2>
          <p>{t('profile.visitorBody')}</p>
          <div className="row">
            <Link href="/connexion?next=/profil" className="btn btn-primary">
              {t('common.signIn')}
            </Link>
            <Link href="/inscription" className="btn btn-outline">
              {t('common.signUp')}
            </Link>
          </div>
        </section>
        {preferences}
      </main>
    );
  }

  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
      <h1>{t('profile.title')}</h1>
      <section className="card stack-sm" aria-labelledby="account-title">
        <h2 id="account-title">{t('profile.account')}</h2>
        <p className="small muted">
          {t('profile.email')} : <strong>{user.email}</strong>
        </p>
        <p className="small muted">
          {t('profile.roles')} :{' '}
          {user.roles.length === 0
            ? t('role.user')
            : user.roles.map((r) => tk(`role.${r}`)).join(', ')}
        </p>
        <ProfileForm
          locale={locale}
          displayName={user.displayName}
          preferredLocale={(user.preferredLocale as Locale | null) ?? locale}
        />
      </section>

      <nav className="card stack-sm" aria-label={t('profile.title')}>
        <Link href="/villages" className="row">
          <MapPinned size={18} aria-hidden="true" /> {t('villages.title')}
        </Link>
        <Link href="/profil/signalements" className="row">
          <FileText size={18} aria-hidden="true" /> {t('report.myReports')}
        </Link>
        <Link href="/profil/notifications" className="row">
          <Bell size={18} aria-hidden="true" /> {t('notifications.preferences')}
        </Link>
        {isStaff(user) && (
          <Link href="/admin" className="row">
            <ShieldCheck size={18} aria-hidden="true" /> {t('nav.admin')}
          </Link>
        )}
      </nav>

      {preferences}

      <section className="card stack-sm" aria-labelledby="data-title">
        <h2 id="data-title">{t('profile.myData')}</h2>
        <a
          href="/api/account/export"
          className="btn btn-outline"
          style={{ alignSelf: 'flex-start' }}
        >
          <Download size={18} aria-hidden="true" /> {t('profile.exportData')}
        </a>
        <DeleteAccountForm locale={locale} />
      </section>

      <section className="card stack-sm" aria-labelledby="security-title">
        <h2 id="security-title">{t('profile.security')}</h2>
        <div className="row">
          <form action={signOutAction}>
            <button type="submit" className="btn btn-outline">
              <LogOut size={18} aria-hidden="true" /> {t('common.signOut')}
            </button>
          </form>
          <form action={signOutEverywhereAction}>
            <button type="submit" className="btn btn-ghost small">
              {t('common.signOut')} (tous les appareils)
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
