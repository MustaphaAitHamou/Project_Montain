import Link from 'next/link';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';

interface Stats {
  users: number;
  reports_pending: number;
  reports_24h: number;
  events_active: number;
  appeals_open: number;
  abuse_open: number;
  media_quarantine: number;
  villages_pending: number;
  assistance_pending: number;
  by_category: Record<string, number>;
  generated_at: string;
}

export default async function AdminDashboard() {
  const { t, tk } = await getI18n();
  const { supabase } = await getSession();
  const { data, error } = supabase
    ? await supabase.rpc('admin_dashboard_stats')
    : { data: null, error: null };
  const stats = data as Stats | null;
  if (error || !stats) {
    return (
      <div className="banner banner-danger" role="alert">
        <p>{t('common.errorGeneric')}</p>
      </div>
    );
  }
  const tiles: [string, number, string][] = [
    [t('admin.statsUsers'), stats.users, '/admin/utilisateurs'],
    [t('admin.statsReportsPending'), stats.reports_pending, '/admin/moderation'],
    [t('admin.statsReports24h'), stats.reports_24h, '/admin/moderation'],
    [t('admin.statsActiveEvents'), stats.events_active, '/admin/evenements'],
    [t('admin.media'), stats.media_quarantine, '/admin/medias'],
    [t('admin.appeals'), stats.appeals_open, '/admin/contestations'],
    [t('admin.abuse'), stats.abuse_open, '/admin/signalements-abus'],
    [t('admin.places'), stats.villages_pending, '/admin/villages'],
    [t('nav.assistance'), stats.assistance_pending, '/admin/entraide'],
  ];
  return (
    <>
      <h1>{t('admin.dashboard')}</h1>
      <div className="stat-grid">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href} className="card card-link stat">
            <span className="small muted">{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
      </div>
      <section className="card stack-sm">
        <h2>{t('admin.byCategory')} (30 j)</h2>
        {Object.keys(stats.by_category).length === 0 ? (
          <p className="muted">{t('alerts.empty')}</p>
        ) : (
          <table className="table">
            <tbody>
              {Object.entries(stats.by_category).map(([category, count]) => (
                <tr key={category}>
                  <th scope="row">{tk(`category.${category}`)}</th>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">{new Date(stats.generated_at).toLocaleString('fr-FR')}</p>
      </section>
    </>
  );
}
