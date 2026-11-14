import Image from 'next/image';
import { getServerEnv } from '@/lib/env.server';

/**
 * Le bouton yaz : le carré rouge au yaz blanc, en haut de chaque app Tamurt.
 * Il ramène à Tamurt Services, qui présente toute la famille d'applications.
 * Affiché seulement quand TAMURT_SERVICES_URL est renseignée : jamais de lien mort.
 */
export function TamurtYaz() {
  const href = getServerEnv().tamurtServicesUrl;
  if (!href) return null;
  return (
    <a href={href} className="tamurt-yaz" title="Tamurt Services" aria-label="Tamurt Services">
      <Image src="/brand/tamurt-yaz.svg" width={34} height={34} alt="" unoptimized />
    </a>
  );
}
