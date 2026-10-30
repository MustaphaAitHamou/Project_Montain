import type { Metadata } from 'next';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { requireUser } from '@/lib/auth';
import { NotificationPreferencesForm } from '@/components/profile/ProfileForms';
import { WebPushControls } from '@/components/profile/WebPushControls';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('notifications.preferences') };
}

export default async function NotificationPreferencesPage() {
  const { t, locale } = await getI18n();
  const { supabase, user } = await requireUser('/profil/notifications');
  const { data } = supabase
    ? await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };
  const d = DEFAULT_NOTIFICATION_PREFERENCES;
  const values = data ?? {
    push_enabled: d.pushEnabled,
    web_push_enabled: d.webPushEnabled,
    min_severity: d.minSeverity,
    include_unverified: d.includeUnverified,
    updates_enabled: d.updatesEnabled,
    resolution_enabled: d.resolutionEnabled,
    quiet_hours_enabled: d.quietHoursEnabled,
    quiet_hours_start: d.quietHoursStart,
    quiet_hours_end: d.quietHoursEnd,
    timezone: d.timezone,
  };
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
      <h1>{t('notifications.preferences')}</h1>
      <div className="banner banner-warning" role="note">
        <div>
          <p className="small">{t('notifications.deliveryDisclaimer')}</p>
          <p className="small">{t('notifications.notOfficial')}</p>
        </div>
      </div>
      <section className="card">
        <NotificationPreferencesForm locale={locale} values={values} />
      </section>
      <section className="card stack-sm">
        <h2>{t('notifications.webPushEnabled')}</h2>
        <WebPushControls locale={locale} />
      </section>
    </main>
  );
}
