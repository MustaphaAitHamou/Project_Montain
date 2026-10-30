import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { reviewVillageAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminVillages() {
  const { t, locale } = await getI18n();
  const { supabase } = await getSession();
  if (!supabase) return null;
  const { data } = await supabase
    .from('villages')
    .select('id, name_fr, commune_code, source, created_at')
    .eq('status', 'pending_review')
    .order('created_at')
    .limit(50);
  const { count } = await supabase
    .from('villages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');
  return (
    <>
      <h1>{t('admin.places')}</h1>
      <p className="small muted">
        Villages actifs : {count ?? 0}. Les propositions de la communauté sont vérifiées avant
        d’apparaître dans la recherche. Les villages issus d’OpenStreetMap s’importent avec le
        script d’import (voir docs/data-sources.md).
      </p>
      {(data ?? []).length === 0 ? (
        <div className="card empty-state">
          <p>Aucune proposition en attente.</p>
        </div>
      ) : (
        <ul className="list-plain stack">
          {(data ?? []).map((v) => (
            <li key={v.id} className="card row-between">
              <span>
                <strong>{v.name_fr}</strong> · commune {v.commune_code ?? '—'} · {v.source} ·{' '}
                {formatDateTime(v.created_at, locale)}
              </span>
              <form action={reviewVillageAction} className="row">
                <input type="hidden" name="id" value={v.id} />
                <button
                  type="submit"
                  name="approve"
                  value="true"
                  className="btn btn-sm btn-primary"
                >
                  {t('admin.approve')}
                </button>
                <button
                  type="submit"
                  name="approve"
                  value="false"
                  className="btn btn-sm btn-outline"
                >
                  {t('admin.reject')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
