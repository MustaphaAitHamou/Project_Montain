import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { requireUser } from '@/lib/auth';
import { withdrawReportAction } from '@/app/actions/account';
import { AppealForm } from '@/components/profile/ProfileForms';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('report.myReports') };
}

export default async function MyReportsPage() {
  const { t, tk, locale } = await getI18n();
  const { supabase, user } = await requireUser('/profil/signalements');
  const { data } = supabase
    ? await supabase
        .from('alert_reports')
        .select(
          'id, subcategory_id, description, moderation_status, rejection_reason, event_id, created_at, commune_code',
        )
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] };
  const reports = data ?? [];
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('report.myReports')}</h1>
        <Link href="/signaler" className="btn btn-primary">
          {t('report.newReport')}
        </Link>
      </div>
      {reports.length === 0 ? (
        <div className="card empty-state">
          <p>{t('report.myReportsEmpty')}</p>
        </div>
      ) : (
        <ul className="list-plain stack-sm">
          {reports.map((r) => (
            <li key={r.id} className="card stack-sm">
              <div className="row-between">
                <strong>{tk(`subcategory.${r.subcategory_id}`)}</strong>
                <span
                  className={
                    r.moderation_status === 'pending'
                      ? 'badge badge-unverified'
                      : 'badge badge-neutral'
                  }
                >
                  {tk(`moderationStatus.${r.moderation_status}`)}
                </span>
              </div>
              <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {r.description}
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                {formatDateTime(r.created_at, locale)}
              </p>
              {r.rejection_reason && (
                <p className="small" style={{ margin: 0 }}>
                  {t('report.rejectionReason', {
                    reason: tk(`rejectionReason.${r.rejection_reason}`),
                  })}
                </p>
              )}
              <div className="row">
                {r.event_id && (
                  <Link href={`/alertes/${r.event_id}`} className="btn btn-sm btn-outline">
                    {t('common.details')}
                  </Link>
                )}
                {r.moderation_status === 'pending' && (
                  <form action={withdrawReportAction}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <button type="submit" className="btn btn-sm btn-outline">
                      {t('report.withdraw')}
                    </button>
                  </form>
                )}
              </div>
              {r.moderation_status === 'rejected' && <AppealForm locale={locale} reportId={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
