import { getI18n } from '@/lib/i18n';
import { getSession } from '@/lib/auth';
import { MfaEnrollment } from '@/components/admin/MfaEnrollment';

export const dynamic = 'force-dynamic';

export default async function AdminMfa() {
  const { t } = await getI18n();
  const { user } = await getSession();
  return (
    <>
      <h1>{t('profile.mfa')}</h1>
      <p className="small muted">
        Niveau de session actuel : <strong>{user?.aal ?? 'inconnu'}</strong>. Utilisez une
        application d’authentification (TOTP). En production, l’administration exige une session
        aal2 (paramètre require_admin_mfa).
      </p>
      <section className="card">
        <MfaEnrollment />
      </section>
    </>
  );
}
