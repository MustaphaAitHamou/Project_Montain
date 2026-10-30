import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, isSeverity } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { requireUser } from '@/lib/auth';
import { markAllNotificationsReadAction } from '@/app/actions/account';
import { SeverityBadge } from '@/components/ui/Badges';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('notifications.title') };
}

export default async function NotificationsPage() {
  const { t, tk, locale } = await getI18n();
  const { supabase } = await requireUser('/notifications');
  const { data } = supabase
    ? await supabase
        .from('user_notifications')
        .select('id, kind, reason, title, body, severity, data, event_id, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] };
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('notifications.title')}</h1>
        <Link href="/profil/notifications" className="small">
          {t('notifications.preferences')}
        </Link>
      </div>
      <p className="small muted">{t('notifications.notOfficial')}</p>
      {unread > 0 && (
        <form action={markAllNotificationsReadAction}>
          <button type="submit" className="btn btn-sm btn-outline">
            {t('notifications.markAllRead')} ({t('notifications.unread', { count: unread })})
          </button>
        </form>
      )}
      {items.length === 0 ? (
        <div className="card empty-state">
          <p>{t('notifications.inboxEmpty')}</p>
        </div>
      ) : (
        <ul className="list-plain stack-sm">
          {items.map((n) => {
            const reportReason = (n.data as { reason?: string } | null)?.reason;
            const body =
              n.kind === 'moderation' && reportReason
                ? `${t('moderationStatus.rejected')} — ${tk(`rejectionReason.${reportReason}`)}`
                : n.body;
            const content = (
              <>
                <div className="row-between">
                  <strong>{n.title}</strong>
                  {n.severity && isSeverity(n.severity) && (
                    <SeverityBadge severity={n.severity} t={t} />
                  )}
                </div>
                <p className="small" style={{ margin: 0 }}>
                  {body}
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  {formatDateTime(n.created_at, locale)}
                  {!n.read_at ? ' · ●' : ''}
                </p>
              </>
            );
            return (
              <li key={n.id}>
                {n.event_id ? (
                  <Link
                    href={`/alertes/${n.event_id}`}
                    className="card card-link stack-sm"
                    style={{ fontWeight: n.read_at ? 400 : 600 }}
                  >
                    {content}
                  </Link>
                ) : n.kind === 'moderation' ? (
                  <Link href="/profil/signalements" className="card card-link stack-sm">
                    {content}
                  </Link>
                ) : (
                  <div className="card stack-sm">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
