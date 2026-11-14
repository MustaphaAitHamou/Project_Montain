import Image from 'next/image';

/** Icône de l'app Tamurt Alerte (DA Tamurt Services) : le point d'exclamation sur le rouge signal. */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <Image
      src="/icon.svg"
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      unoptimized
    />
  );
}

/**
 * Logo Tamurt Alerte : le mot TAMURT rouge et sa ligne ⵜⴰⵎⵓⵔⵜ, puis ALERTE en blanc sur un pavé rouge.
 * Deux fichiers dans public/brand (fond clair, fond sombre) : la feuille de style affiche celui du thème.
 */
export function Logo({
  height = 30,
  label = 'Tamurt Alerte',
}: {
  height?: number;
  label?: string;
}) {
  const width = Math.round((height * 848.7) / 219);
  return (
    <>
      <Image
        className="logo-clair"
        src="/brand/wordmark.svg"
        width={width}
        height={height}
        alt={label}
        unoptimized
        priority
      />
      <Image
        className="logo-sombre"
        src="/brand/wordmark-sombre.svg"
        width={width}
        height={height}
        alt={label}
        unoptimized
      />
    </>
  );
}
