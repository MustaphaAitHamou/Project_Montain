import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { AssistanceForm } from '@/components/assistance/AssistanceForm';
import { AbuseReportForm } from '@/components/events/AbuseReportForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('assistance.title') };
}

export default async function AssistancePage() {
  const { t, tk, locale } = await getI18n();
  const { supabase, user } = await getSession();
  const [{ data: posts }, { data: communes }] = supabase
    ? await Promise.all([
        supabase
          .from('community_assistance')
          .select(
            'id, kind, title, description, commune_code, is_verified_public_aid_point, created_at, expires_at',
          )
          .eq('status', 'published')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('communes').select('code, name_fr, name_ar, wilaya_code').order('name_fr'),
      ])
    : [{ data: [] }, { data: [] }];
  const communeName = new Map(
    (communes ?? []).map((c) => [c.code, locale === 'ar' && c.name_ar ? c.name_ar : c.name_fr]),
  );

  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 860 }}>
      <h1>{t('assistance.title')}</h1>
      <div className="banner banner-warning" role="note">
        <div>
          <p className="small">{t('assistance.intro')}</p>
          <p className="small">{t('assistance.noContactNotice')}</p>
        </div>
      </div>

      {(posts ?? []).length === 0 ? (
        <div className="card empty-state">
          <p>{t('assistance.empty')}</p>
        </div>
      ) : (
        <ul className="list-plain stack-sm">
          {(posts ?? []).map((p) => (
            <li key={p.id} className="card stack-sm">
              <div className="row-between">
                <strong>{p.title}</strong>
                <span className="badge badge-neutral">{tk(`assistance.kind.${p.kind}`)}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.description}</p>
              <p className="small muted" style={{ margin: 0 }}>
                {communeName.get(p.commune_code) ?? p.commune_code} ·{' '}
                {formatDateTime(p.created_at, locale)}
                {p.is_verified_public_aid_point ? ' · ✓ lieu d’aide vérifié' : ''}
              </p>
              {user && <AbuseReportForm targetType="assistance" targetId={p.id} locale={locale} />}
            </li>
          ))}
        </ul>
      )}

      <section className="card stack-sm" aria-labelledby="create-title">
        <h2 id="create-title">{t('assistance.create')}</h2>
        {user ? (
          <AssistanceForm
            locale={locale}
            communes={(communes ?? []).map((c) => ({
              code: c.code,
              name: locale === 'ar' && c.name_ar ? c.name_ar : c.name_fr,
              wilaya: c.wilaya_code,
            }))}
          />
        ) : (
          <Link href="/connexion?next=/entraide" className="btn btn-primary">
            {t('common.signIn')}
          </Link>
        )}
        <p className="small muted">{t('assistance.safetyNotice')}</p>
      </section>
    </main>
  );
}
