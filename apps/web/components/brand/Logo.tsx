/**
 * Symbole Tamurt Alerte : un bouclier (protection), une ligne de crêtes (la montagne
 * kabyle) et des ondes de vigilance. Création originale, sans reprise d'une identité officielle.
 */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M32 3 56 11v19c0 15-10.5 25.5-24 31C18.5 55.5 8 45 8 30V11z"
        fill="#153D30"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M14 47 25 31l6 8 7-12 12 20z" fill="#FFFFFF" />
      <path d="M33 39 38 30.5 42 37z" fill="#2D7B57" />
      <circle cx="32" cy="19" r="2.8" fill="#F59E0B" />
      <path
        d="M25.5 19a6.5 6.5 0 0 1 13 0M20.5 19a11.5 11.5 0 0 1 23 0"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ size = 32, label = 'Tamurt Alerte' }: { size?: number; label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      <span>{label}</span>
    </span>
  );
}
