import Link from 'next/link';
import { Bell, LogIn, UserRound } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { BottomNav, TopNav, type NavItem } from '@/components/layout/NavLinks';
import { ConnectivityBanner } from '@/components/layout/ConnectivityBanner';
import { OfflineSync } from '@/components/layout/OfflineSync';
import { PreferenceControls } from '@/components/layout/PreferenceControls';
import { getI18n, getThemePreference } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { getPublicSettings } from '@/lib/data/settings';
import { getPublicEnv } from '@/lib/env';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { t, locale, info } = await getI18n();
  const theme = await getThemePreference();
  const { user, supabase, backend } = await getSession();
  const settings = await getPublicSettings();
  const demoMode = settings.demoMode || getPublicEnv().demoMode;

  let unread = 0;
  if (supabase && user) {
    const { count } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    unread = count ?? 0;
  }

  const items: NavItem[] = [
    { href: '/', label: t('nav.home'), icon: 'home' },
    { href: '/carte', label: t('nav.map'), icon: 'map' },
    { href: '/signaler', label: t('nav.report'), icon: 'report' },
    { href: '/alertes', label: t('nav.alerts'), icon: 'alerts' },
    { href: '/profil', label: t('nav.profile'), icon: 'profile' },
  ];

  return (
    <div className="app-shell">
      <a href="#contenu" className="skip-link">
        {t('nav.skipToContent')}
      </a>
      <header className="site-header">
        <div className="container">
          <Link href="/" className="brand">
            <LogoMark size={34} />
            <span>{t('app.name')}</span>
          </Link>
          <TopNav items={items} label={t('nav.mainNavigation')} />
          <div className="header-actions">
            {user ? (
              <>
                <Link
                  href="/notifications"
                  className="btn btn-ghost icon-btn"
                  aria-label={`${t('nav.notifications')}${unread > 0 ? ` (${t('notifications.unread', { count: unread })})` : ''}`}
                  style={{ color: 'inherit', position: 'relative' }}
                >
                  <Bell size={22} aria-hidden="true" />
                  {unread > 0 && (
                    <span
                      aria-hidden="true"
                      className="badge badge-critical"
                      style={{
                        position: 'absolute',
                        insetBlockStart: 0,
                        insetInlineEnd: -4,
                        padding: '0 6px',
                      }}
                    >
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
                <Link
                  href="/profil"
                  className="btn btn-ghost icon-btn"
                  aria-label={t('nav.profile')}
                  style={{ color: 'inherit' }}
                >
                  <UserRound size={22} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <Link
                href="/connexion"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              >
                <LogIn size={18} aria-hidden="true" />
                {t('common.signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <ConnectivityBanner
        title={t('connectivity.offline')}
        detail={t('connectivity.offlineDetail')}
      />
      <OfflineSync locale={locale} signedIn={Boolean(user)} />
      {backend === 'not_configured' && (
        <div className="container" style={{ paddingBlockStart: 12 }}>
          <div className="banner banner-warning" role="status">
            <p>{t('connectivity.notConfigured')}</p>
          </div>
        </div>
      )}
      {backend === 'unreachable' && (
        <div className="container" style={{ paddingBlockStart: 12 }}>
          <div className="banner banner-danger" role="alert">
            <p>{t('connectivity.backendUnavailable')}</p>
          </div>
        </div>
      )}
      {demoMode && (
        <div className="container" style={{ paddingBlockStart: 12 }}>
          <div className="banner banner-demo" role="note">
            <span className="badge badge-demo">{t('demo.badge')}</span>
            <p>{t('demo.banner')}</p>
          </div>
        </div>
      )}
      {info.reviewStatus !== 'reference' && (
        <div className="container" style={{ paddingBlockStart: 12 }}>
          <div className="banner banner-info" role="note">
            <p className="small">
              {info.reviewStatus === 'provisional'
                ? t('i18n.provisionalNotice')
                : t('i18n.unreviewedNotice')}
            </p>
          </div>
        </div>
      )}

      {children}

      <footer className="site-footer">
        <div className="container stack-sm">
          <nav aria-label={t('nav.about')}>
            <Link href="/a-propos">{t('nav.about')}</Link>
            <Link href="/consignes">{t('nav.safety')}</Link>
            <Link href="/entraide">{t('nav.assistance')}</Link>
            <Link href="/confidentialite">{t('nav.privacy')}</Link>
            <Link href="/conditions">{t('nav.terms')}</Link>
          </nav>
          <p>{t('app.disclaimerShort')}</p>
          <p>
            {t('map.attribution')} (
            <a
              href="https://www.openstreetmap.org/copyright"
              rel="noopener noreferrer"
              target="_blank"
            >
              ODbL
            </a>
            ) · Icônes Lucide (ISC)
          </p>
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
          <p>
            © {new Date().getFullYear()} {t('app.publisher')} — {t('app.slogan')}
          </p>
        </div>
      </footer>
      <BottomNav items={items} label={t('nav.mainNavigation')} />
    </div>
  );
}
