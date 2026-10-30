import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('legal.termsTitle') };
}

export default async function TermsPage() {
  const { t } = await getI18n();
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }} lang="fr">
      <h1>{t('legal.termsTitle')}</h1>
      <div className="banner banner-warning" role="note">
        <p>{t('legal.draftNotice')}</p>
      </div>
      <section className="card stack-sm">
        <h2>Nature du service</h2>
        <p>
          Tamurt Alerte est un service communautaire d’information. Il ne constitue pas un service
          officiel de secours, ne remplace pas les autorités et ne garantit ni l’exhaustivité des
          informations ni la réception immédiate des notifications.
        </p>
      </section>
      <section className="card stack-sm">
        <h2>Engagements des utilisateurs</h2>
        <ul>
          <li>
            Signaler de bonne foi ce que l’on a observé ; ne pas publier d’information
            volontairement fausse.
          </li>
          <li>
            Ne publier aucune donnée personnelle (numéro, adresse, identité de tiers, photo de
            personnes reconnaissables).
          </li>
          <li>Ne jamais inciter quiconque à se rendre dans une zone dangereuse.</li>
        </ul>
      </section>
      <section className="card stack-sm">
        <h2>Modération</h2>
        <p>
          Les signalements sont examinés avant publication. Un refus est motivé et peut être
          contesté depuis l’espace « Mes signalements ». Les abus répétés peuvent entraîner la
          suspension du compte.
        </p>
      </section>
    </main>
  );
}
