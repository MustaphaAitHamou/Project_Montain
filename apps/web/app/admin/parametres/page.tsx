import { getI18n } from '@/lib/i18n';
import { getSession, isAdmin } from '@/lib/auth';
import { ActionForm } from '@/components/admin/ActionForm';
import { updateSettingAction } from '@/app/actions/admin';

export const dynamic = 'force-dynamic';

const HELP: Record<string, string> = {
  demo_mode: 'true/false — affiche les données marquées DÉMO. Ne jamais activer en production.',
  require_admin_mfa:
    'true/false — exige une session TOTP (aal2) pour les fonctions d’administration.',
  ads_enabled:
    'true/false — composant publicitaire (aucune régie intégrée ; jamais sur les écrans d’urgence).',
  push_rate_limit_per_hour:
    'Nombre entier — push non critiques maximum par utilisateur et par heure.',
  auto_publish_categories:
    'Tableau JSON, ex. ["fire"] — catégories publiées immédiatement au statut « Reçu, non vérifié » (plafonné à Vigilance). Vide = modération préalable.',
  emergency_numbers:
    'JSON {"verified": true, "items": [{"label": "…", "number": "…"}]} — ne marquer « verified » qu’après vérification auprès des sources officielles.',
};

export default async function AdminSettings() {
  const { t } = await getI18n();
  const { supabase, user } = await getSession();
  if (!supabase || !isAdmin(user)) return <p>{t('admin.forbidden')}</p>;
  const { data } = await supabase
    .from('app_settings')
    .select('key, value, is_public, description, updated_at')
    .order('key');
  return (
    <>
      <h1>{t('admin.settings')}</h1>
      <ul className="list-plain stack">
        {(data ?? []).map((s) => (
          <li key={s.key} className="card stack-sm">
            <div className="row-between">
              <strong>
                <code>{s.key}</code>
              </strong>
              <span className="badge badge-neutral">{s.is_public ? 'public' : 'privé'}</span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {s.description}
            </p>
            {HELP[s.key] ? (
              <ActionForm action={updateSettingAction} submitLabel={t('common.save')}>
                <input type="hidden" name="key" value={s.key} />
                <label className="sr-only" htmlFor={`v-${s.key}`}>
                  {s.key}
                </label>
                <textarea
                  id={`v-${s.key}`}
                  name="value"
                  className="textarea"
                  style={{ minHeight: 60, fontFamily: 'monospace' }}
                  defaultValue={JSON.stringify(s.value)}
                />
                <p className="hint">{HELP[s.key]}</p>
              </ActionForm>
            ) : (
              <code>{JSON.stringify(s.value)}</code>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
