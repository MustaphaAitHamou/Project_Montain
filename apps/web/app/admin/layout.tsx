import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { getI18n } from '@/lib/i18n';
import { adminMfaSatisfied, getSession, isAdmin, isStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Administration',
  robots: { index: false, follow: false },
};

/**
 * Espace d'administration. Ce contrôle d'accès est un confort d'affichage : chaque action
 * est de nouveau vérifiée par la base (RLS, fonctions SECURITY DEFINER) et par les routes serveur.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  const { user } = await getSession();

  if (!user || !isStaff(user)) {
    return (
      <main className="page container stack" id="contenu" style={{ maxWidth: 560 }}>
        <h1>{t('admin.title')}</h1>
        <div className="banner banner-danger" role="alert">
          <p>{t('admin.forbidden')}</p>
        </div>
        {!user && (
          <Link href="/connexion?next=/admin" className="btn btn-primary">
            {t('common.signIn')}
          </Link>
        )}
        <Link href="/">{t('nav.home')}</Link>
      </main>
    );
  }

  const admin = isAdmin(user);
  const links: [string, string, boolean][] = [
    ['/admin', t('admin.dashboard'), true],
    ['/admin/moderation', t('admin.moderation'), true],
    ['/admin/evenements', t('admin.events'), true],
    ['/admin/medias', t('admin.media'), true],
    ['/admin/contestations', t('admin.appeals'), true],
    ['/admin/signalements-abus', t('admin.abuse'), true],
    ['/admin/villages', t('admin.places'), true],
    ['/admin/entraide', t('nav.assistance'), true],
    ['/admin/utilisateurs', t('admin.users'), admin],
    ['/admin/sources', t('admin.sources'), admin],
    ['/admin/notifications', t('admin.notifications'), admin],
    ['/admin/audit', t('admin.audit'), admin],
    ['/admin/parametres', t('admin.settings'), admin],
    ['/admin/mfa', t('profile.mfa'), true],
  ];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <Link href="/admin" className="brand">
            <LogoMark size={30} />
            <span>{t('admin.title')}</span>
          </Link>
          <div className="header-actions">
            <Link
              href="/"
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              {t('nav.home')}
            </Link>
          </div>
        </div>
      </header>
      <div className="container admin-grid">
        <nav aria-label={t('admin.title')} className="admin-nav card">
          <ul className="list-plain stack-sm">
            {links
              .filter(([, , visible]) => visible)
              .map(([href, label]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
          </ul>
        </nav>
        <main className="page stack" id="contenu" style={{ minWidth: 0 }}>
          {admin && !adminMfaSatisfied(user) && (
            <div className="banner banner-warning" role="alert">
              <p>
                {t('admin.mfaNeeded')} <Link href="/admin/mfa">{t('profile.mfa')}</Link>
              </p>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
