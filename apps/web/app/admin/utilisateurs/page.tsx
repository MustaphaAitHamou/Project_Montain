import { APP_ROLES, formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getSession, isAdmin } from '@/lib/auth';
import { ActionForm } from '@/components/admin/ActionForm';
import { setRoleAction, setSuspensionAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { t, tk, locale } = await getI18n();
  const { supabase, user } = await getSession();
  if (!supabase || !isAdmin(user)) return <p>{t('admin.forbidden')}</p>;
  const { q } = await searchParams;
  const { data, error } = await supabase.rpc('admin_find_users', { p_query: q ?? '', p_limit: 30 });
  return (
    <>
      <h1>{t('admin.users')}</h1>
      <p className="small muted">
        Les rôles sont attribués manuellement, avec justification tracée dans le journal d’audit. La
        réputation est indicative : elle n’attribue jamais de rôle automatiquement.
      </p>
      <form className="row" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="e-mail, nom ou rôle"
          aria-label={t('common.search')}
        />
        <button type="submit" className="btn btn-outline">
          {t('common.search')}
        </button>
      </form>
      {error && (
        <p className="banner banner-danger">
          {error.message.startsWith('mfa_required')
            ? t('admin.mfaNeeded')
            : t('common.errorGeneric')}
        </p>
      )}
      <ul className="list-plain stack">
        {(data ?? []).map((u) => (
          <li key={u.id} className="card stack-sm">
            <div className="row-between">
              <strong>{u.email}</strong>
              <span className="small muted">
                {u.display_name ?? '—'} · réputation {u.reputation ?? 0} · {u.reports_count}{' '}
                signalement(s)
              </span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Inscrit le {formatDateTime(u.created_at, locale)} · rôles :{' '}
              {u.roles.length ? u.roles.map((r) => tk(`role.${r}`)).join(', ') : t('role.user')}
              {u.is_suspended ? ' · SUSPENDU' : ''}
            </p>
            <details>
              <summary className="small">{t('profile.roles')}</summary>
              <ActionForm
                action={setRoleAction}
                submitLabel={t('common.confirm')}
                className="inline-form"
              >
                <input type="hidden" name="userId" value={u.id} />
                <div className="field">
                  <label htmlFor={`role-${u.id}`}>Rôle</label>
                  <select id={`role-${u.id}`} name="role" className="select">
                    {APP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {tk(`role.${r}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`grant-${u.id}`}>Action</label>
                  <select id={`grant-${u.id}`} name="grant" className="select">
                    <option value="true">{t('admin.grant')}</option>
                    <option value="false">{t('admin.revoke')}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`org-${u.id}`}>Organisation (partenaire)</label>
                  <input id={`org-${u.id}`} name="organization" className="input" maxLength={120} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor={`why-${u.id}`}>{t('admin.justification')}</label>
                  <input
                    id={`why-${u.id}`}
                    name="reason"
                    className="input"
                    required
                    minLength={3}
                  />
                </div>
              </ActionForm>
              <form action={setSuspensionAction} className="row" style={{ marginBlockStart: 8 }}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="suspended" value={u.is_suspended ? 'false' : 'true'} />
                <input
                  name="reason"
                  className="input"
                  style={{ maxWidth: 280 }}
                  placeholder={t('admin.justification')}
                  required
                  minLength={3}
                />
                <button type="submit" className="btn btn-sm btn-outline">
                  {u.is_suspended ? 'Lever la suspension' : 'Suspendre'}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
