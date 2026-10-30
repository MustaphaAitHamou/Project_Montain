import type { Metadata } from 'next';
import { formatDateTime } from '@tamurt/shared';
import { getI18n } from '@/lib/i18n';
import { getPublicSettings } from '@/lib/data/settings';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('safety.title') };
}

/**
 * Consignes générales de prudence, volontairement non spécifiques : elles ne remplacent
 * jamais les instructions des autorités. Les numéros d'urgence ne sont affichés qu'après
 * vérification par l'équipe (paramètre emergency_numbers.verified).
 */
const GUIDANCE: { title: string; items: string[] }[] = [
  {
    title: 'En toutes circonstances',
    items: [
      'Suivez en priorité les instructions des autorités, de la Protection civile et des services de secours.',
      'N’allez jamais vers une zone dangereuse pour observer, filmer ou photographier.',
      'Gardez les voies d’accès libres pour les secours.',
      'Vérifiez une information avant de la partager ; signalez ce que vous avez vu vous-même.',
    ],
  },
  {
    title: 'Fumée ou incendie',
    items: [
      'Éloignez-vous de la fumée et ne vous engagez pas dans une zone en feu.',
      'Si l’on vous demande d’évacuer, faites-le sans attendre.',
    ],
  },
  {
    title: 'Fortes pluies, crues et glissements de terrain',
    items: [
      'Ne traversez pas une route ou un pont submergé, à pied comme en véhicule.',
      'Éloignez-vous des berges, des ravins et des talus instables.',
    ],
  },
  {
    title: 'Séisme',
    items: [
      'Pendant la secousse : protégez-vous la tête, éloignez-vous des vitres.',
      'Après : sortez avec prudence, sans utiliser l’ascenseur, et éloignez-vous des bâtiments endommagés.',
    ],
  },
];

export default async function SafetyPage() {
  const { t, locale } = await getI18n();
  const settings = await getPublicSettings();
  const numbers = settings.emergencyNumbers;
  return (
    <main className="page container stack" id="contenu" style={{ maxWidth: 760 }}>
      <h1>{t('safety.title')}</h1>
      <div className="banner banner-info" role="note">
        <p>{t('safety.intro')}</p>
      </div>
      <section className="card stack-sm" aria-labelledby="numbers-title">
        <h2 id="numbers-title">{t('safety.emergencyNumbers')}</h2>
        {numbers.verified && numbers.items.length > 0 ? (
          <>
            <ul className="list-plain stack-sm">
              {numbers.items.map((n) => (
                <li key={`${n.label}-${n.number}`} className="row-between">
                  <span>{n.label}</span>
                  <a href={`tel:${n.number.replace(/\s/g, '')}`} className="btn btn-sm btn-danger">
                    {n.number}
                  </a>
                </li>
              ))}
            </ul>
            {numbers.verified_at && (
              <p className="small muted">
                {t('safety.verifiedOn', { date: formatDateTime(numbers.verified_at, locale) })}
              </p>
            )}
          </>
        ) : (
          <p className="muted">{t('safety.emergencyPending')}</p>
        )}
      </section>
      {GUIDANCE.map((g) => (
        <section key={g.title} className="card stack-sm" lang="fr">
          <h2>{g.title}</h2>
          <ul>
            {g.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
