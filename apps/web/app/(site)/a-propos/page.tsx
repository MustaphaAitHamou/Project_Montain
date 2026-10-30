import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('legal.aboutTitle') };
}

export default async function AboutPage() {
  const { t } = await getI18n();
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
      <h1>{t('legal.aboutTitle')}</h1>
      <p>
        <strong>{t('app.name')}</strong> — {t('app.slogan')} Application communautaire de
        surveillance et d’information géolocalisée publiée par {t('app.publisher')}, pour la Kabylie
        et sa diaspora.
      </p>
      <div className="banner banner-warning" role="note">
        <p>{t('app.disclaimerShort')}</p>
      </div>
      <section className="card stack-sm" lang="fr">
        <h2>Comment les informations sont vérifiées</h2>
        <ul>
          <li>
            Chaque signalement est reçu avec le statut « Reçu, non vérifié » et examiné par l’équipe
            de modération.
          </li>
          <li>
            Les statuts publics distinguent : en cours de vérification, recoupé par plusieurs
            sources, confirmé par une source habilitée, terminé.
          </li>
          <li>Une information non vérifiée ne peut pas dépasser le niveau « Vigilance ».</li>
          <li>Un point chaud détecté par satellite est un indice, jamais un incendie confirmé.</li>
          <li>
            Les séismes affichés proviennent d’un réseau sismologique ; ils ne sont pas prédits.
          </li>
        </ul>
      </section>
      <section className="card stack-sm" lang="fr">
        <h2>Sources et licences</h2>
        <ul>
          <li>Limites administratives : © contributeurs OpenStreetMap, licence ODbL 1.0.</li>
          <li>Séismes : EMSC-CSEM (lorsque la source est activée).</li>
          <li>Points chauds : NASA FIRMS (lorsque la source est activée).</li>
          <li>
            Prévisions météo : Open-Meteo (lorsque la source est activée) — distinctes des
            vigilances officielles.
          </li>
        </ul>
      </section>
    </main>
  );
}
