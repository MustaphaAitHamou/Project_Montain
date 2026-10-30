import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('legal.privacyTitle') };
}

export default async function PrivacyPage() {
  const { t } = await getI18n();
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }} lang="fr">
      <h1>{t('legal.privacyTitle')}</h1>
      <div className="banner banner-warning" role="note">
        <p>{t('legal.draftNotice')}</p>
      </div>
      <section className="card stack-sm">
        <h2>Responsable du traitement</h2>
        <p>Tamurt Services (coordonnées du délégué à la protection des données à compléter).</p>
        <p>
          Cadres applicables : loi algérienne n° 18-07 relative à la protection des personnes
          physiques dans le traitement des données à caractère personnel ; RGPD lorsque des
          personnes situées dans l’Union européenne sont concernées. Analyse juridique à faire
          valider.
        </p>
      </section>
      <section className="card stack-sm">
        <h2>Données collectées (minimisation)</h2>
        <ul>
          <li>
            Compte : adresse e-mail, mot de passe (haché par le fournisseur d’authentification), nom
            affiché facultatif. Aucun numéro de téléphone n’est demandé.
          </li>
          <li>
            Lieux suivis : positions et rayons que vous choisissez (pas de géolocalisation
            continue).
          </li>
          <li>
            Signalements : catégorie, description, position du phénomène, heure observée, photo
            facultative.
          </li>
          <li>Notifications : jetons techniques des appareils et préférences.</li>
        </ul>
      </section>
      <section className="card stack-sm">
        <h2>Ce que nous ne faisons pas</h2>
        <ul>
          <li>
            Aucune localisation en arrière-plan ; la position GPS n’est utilisée qu’à votre demande
            et n’est pas enregistrée.
          </li>
          <li>Aucune revente de données, en particulier des positions.</li>
          <li>
            Les métadonnées des photos (dont la position GPS) sont supprimées avant toute
            publication.
          </li>
          <li>L’identité des auteurs de signalements n’est jamais publiée.</li>
        </ul>
      </section>
      <section className="card stack-sm">
        <h2>Durées de conservation</h2>
        <ul>
          <li>Signalements rejetés ou retirés : contenu anonymisé après 180 jours.</li>
          <li>Notifications : 180 jours ; journaux de remise : 90 jours.</li>
          <li>Observations satellites non rattachées : 30 jours ; prévisions : 7 jours.</li>
          <li>Journal d’audit : 12 mois.</li>
        </ul>
      </section>
      <section className="card stack-sm">
        <h2>Vos droits</h2>
        <p>
          Accès et portabilité : téléchargez vos données depuis{' '}
          <Link href="/profil">votre profil</Link>. Suppression : le compte peut être supprimé
          définitivement depuis le profil ; vos signalements sont alors anonymisés. Pour toute autre
          demande (rectification, opposition), contactez l’équipe (adresse à compléter).
        </p>
      </section>
    </main>
  );
}
