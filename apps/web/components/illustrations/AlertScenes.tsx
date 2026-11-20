/*
 * Illustrations originales de Tamurt Alerte (DA Tamurt Services : rouge signal, blanc et noir).
 * Purement décoratives (aria-hidden). Le contour de l'Algérie est simplifié d'après les
 * contours OpenStreetMap du référentiel (© contributeurs OpenStreetMap, ODbL).
 * Les animations (classes ta-*) s'arrêtent si l'utilisateur limite les mouvements ; les scènes
 * hors bandeau suivent le thème clair/sombre via les classes ill-* (globals.css).
 */

const RED = '#d9261c';
const BLACK = '#111111';
const ORANGE = '#f8ba3c';

/** Contour de l'Algérie (projection de Mercator), repère de VigilMapIllustration. */
const ALGERIA_PATH =
  'M219.4 319.3 212.6 316.7 212.6 310.8 125.7 249.6 70 212.2 70 189.8 85.4 178.1 89.2 177.8 92.1 175.5 97.6 176.5 111.6 174.1 115.2 176.2 119.8 168.7 133 158.8 142.8 156.3 142.7 153.3 144.4 150.7 142.4 148.3 141 149.3 140.7 146.9 142.6 144.2 142.6 140.1 154.8 137.3 153.6 131.7 166.7 130.6 179 131.8 176.9 131.2 177.6 128.2 181.2 124.9 175.5 120.9 173.3 117.4 174.4 115.5 171.5 111.8 172.6 106.1 170.6 104.5 171.8 97.5 169.9 92.4 171.1 90.7 168.8 88.4 170.3 86.2 163.6 80.8 170.2 79.3 174.3 75.7 177 75.3 178.4 71.4 182.2 68.6 186.9 68.7 190.3 65.3 194.4 67.4 200.8 60.2 211.5 54.8 229.9 52.1 232.9 53 238.7 49 241.7 50.3 252.3 47 264.9 47.5 272.5 52.2 286 47.3 288.9 44.1 296.3 47.8 300.2 46.7 300.5 44 309 46.2 309.8 48.5 315.2 46.5 321.2 46.7 321.7 49.3 318.6 50.2 318.5 52.9 314.3 55.2 318 56.5 315.8 68.1 317.6 73 316.6 76.1 319 77.4 315.7 83.1 316.7 86.5 315.2 89.3 309.9 92.3 309.1 95.7 305.3 98.2 305.2 102.7 309.5 113.2 313.7 114.8 316.7 119.6 317.2 125.1 327.6 132.2 334.7 163.8 332.3 164.8 332.4 166.6 337.9 177.3 339.6 188.4 338.6 196.2 340.5 202.8 337.9 211.3 339.8 223 339 225.2 333.9 227.3 332.4 230.3 341.5 243.7 341.6 250 344.1 255 346.2 256.7 354 256.5 361.5 262.1 364.2 261.1 370 273.2 304.2 315.1 280.2 336.8 244.5 344.1 240.9 341.1 243.1 336.5 243 330.7 235.5 328.3 234.8 326.7 230.2 327.7 230.5 326.1 227.9 323.3 223.7 324.7 220 321.9 219.4 319.3Z';

/** Villes repérées sur la carte (mêmes coordonnées projetées que le contour). */
const CITIES: [number, number][] = [
  [240.2, 50.3], // Alger
  [186.7, 69.3], // Oran
  [291.8, 57.3], // Constantine
  [308.5, 47.6], // Annaba
  [279, 84.3], // Biskra
  [176.8, 83.8], // Tlemcen
  [163.7, 140.3], // Béchar
  [273.1, 134.7], // Ouargla
  [191.6, 202.9], // Adrar
  [318.7, 225.6], // Illizi
  [77.7, 206.3], // Tindouf
  [276, 284.7], // Tamanrasset
  [333.4, 256.6], // Djanet
];

const RADAR = { x: 220, y: 190 };

function Sparkle({
  x,
  y,
  size,
  delay = 0,
}: {
  x: number;
  y: number;
  size: number;
  delay?: number;
}) {
  const k = size * 0.22;
  return (
    <path
      className="ta-twinkle"
      style={{ animationDelay: `${delay}s` }}
      d={`M${x} ${y - size}C${x + k} ${y - k} ${x + k} ${y - k} ${x + size} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + size}C${x - k} ${y + k} ${x - k} ${y + k} ${x - size} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - size}Z`}
      fill="#ffffff"
    />
  );
}

type Glyph = 'fire' | 'flood' | 'quake';

/** Épingle d'alerte noire (pointe en 0,0), pictogramme blanc. */
function AlertPin({ x, y, glyph, delay }: { x: number; y: number; glyph: Glyph; delay: number }) {
  return (
    <g className="ta-bob" style={{ animationDelay: `${delay}s` }}>
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="1.5" rx="6" ry="2" fill={BLACK} opacity="0.35" />
        <path
          d="M0 0C-3 -6 -13 -13 -13 -24a13 13 0 0 1 26 0c0 11 -10 18 -13 24Z"
          fill={BLACK}
          stroke="#ffffff"
          strokeWidth="2"
        />
        {glyph === 'fire' && (
          <path
            d="M0.5 -34c4 4 6.5 7 6.5 10.5a7 7 0 0 1 -14 0c0 -2.8 1.6 -4.8 3 -6c0 2 1 3.2 2.2 3.2c0 -3 0 -5 2.3 -7.7Z"
            fill={ORANGE}
          />
        )}
        {glyph === 'flood' && (
          <path
            d="M-8 -28.5q2 -2.4 4 0t4 0t4 0t4 0M-8 -23q2 -2.4 4 0t4 0t4 0t4 0M-8 -17.5q2 -2.4 4 0t4 0t4 0t4 0"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {glyph === 'quake' && (
          <path
            d="M-9 -23h4l3 -7l4 14l3 -7h4"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </g>
  );
}

/**
 * Bandeau d'accueil : l'Algérie entière sous un balayage radar, villes en veille et alertes
 * qui se signalent. Conçue pour le fond rouge du bandeau (couleurs fixes).
 */
export function VigilMapIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 360" aria-hidden="true" className={className}>
      <defs>
        <clipPath id="ta-dz-clip">
          <path d={ALGERIA_PATH} />
        </clipPath>
        <radialGradient id="ta-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={RADAR.x} cy={RADAR.y} r="200" fill="url(#ta-halo)" />
      {[110, 150, 190].map((r, i) => (
        <circle
          key={r}
          cx={RADAR.x}
          cy={RADAR.y}
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.2 - i * 0.05}
          strokeWidth="1.5"
          strokeDasharray={i === 1 ? '4 6' : undefined}
        />
      ))}

      {/* Socle noir décalé, puis le pays en blanc */}
      <path d={ALGERIA_PATH} transform="translate(9 11)" fill={BLACK} />
      <path
        d={ALGERIA_PATH}
        fill="#ffffff"
        stroke={BLACK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Balayage radar limité au territoire */}
      <g clipPath="url(#ta-dz-clip)">
        {[50, 100, 150].map((r) => (
          <circle
            key={r}
            cx={RADAR.x}
            cy={RADAR.y}
            r={r}
            fill="none"
            stroke={RED}
            strokeOpacity="0.16"
            strokeWidth="1.5"
          />
        ))}
        <g className="ta-sweep" style={{ transformOrigin: `${RADAR.x}px ${RADAR.y}px` }}>
          <path
            d={`M${RADAR.x} ${RADAR.y}L${RADAR.x} ${RADAR.y - 190}A190 190 0 0 1 ${RADAR.x + 134.4} ${RADAR.y - 134.4}Z`}
            fill={RED}
            fillOpacity="0.14"
          />
          <path
            d={`M${RADAR.x} ${RADAR.y}L${RADAR.x + 134.4} ${RADAR.y - 134.4}`}
            stroke={RED}
            strokeOpacity="0.55"
            strokeWidth="2"
          />
        </g>
      </g>

      {/* Villes en veille */}
      {CITIES.map(([x, y], i) => (
        <g key={`${x}-${y}`}>
          <circle
            cx={x}
            cy={y}
            r="4"
            fill="none"
            stroke={RED}
            strokeWidth="2"
            className="ta-ping"
            style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${(i % 5) * 0.55}s` }}
          />
          <circle cx={x} cy={y} r="3.6" fill={RED} stroke="#ffffff" strokeWidth="1.4" />
        </g>
      ))}

      {/* Alertes qui se signalent */}
      <AlertPin x={254.5} y={48} glyph="fire" delay={0} />
      <AlertPin x={186.7} y={66} glyph="quake" delay={0.8} />
      <AlertPin x={249.1} y={122} glyph="flood" delay={1.6} />

      <Sparkle x={58} y={70} size={9} />
      <Sparkle x={396} y={118} size={7} delay={1.2} />
      <Sparkle x={392} y={306} size={10} delay={0.6} />
      <Sparkle x={52} y={300} size={6} delay={1.8} />
    </svg>
  );
}

/** Maison kabyle : murs clairs, toit de tuiles rouge, fenêtre sombre. */
function House({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * 0.66;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} className="ill-paper ill-stroke" strokeWidth="2" />
      <path
        d={`M-3 1 ${w / 2} ${-h * 0.62} ${w + 3} 1Z`}
        fill={RED}
        className="ill-stroke"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x={w * 0.2} y={h * 0.32} width={w * 0.22} height={h * 0.3} className="ill-ink" />
      <rect x={w * 0.58} y={h * 0.4} width={w * 0.22} height={h * 0.6} className="ill-ink" />
    </g>
  );
}

/**
 * État « rien à signaler » : village paisible au pied des montagnes, soleil, bouclier de veille.
 * Suit le thème (classes ill-*).
 */
export function CalmVillageScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true" className={className}>
      <g className="ta-spin-slow" style={{ transformOrigin: '258px 42px' }}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={258 + Math.cos(a) * 22}
              y1={42 + Math.sin(a) * 22}
              x2={258 + Math.cos(a) * 29}
              y2={42 + Math.sin(a) * 29}
              stroke={ORANGE}
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <circle cx="258" cy="42" r="16" fill={ORANGE} />

      <path
        d="M14 122 48 66 78 90 122 40 168 96 200 72 246 108 282 84 306 122Z"
        className="ill-mist"
      />
      <path d="M110 53 122 40 134 54 126 50 118 56Z" className="ill-paper" />
      <ellipse cx="160" cy="127" rx="152" ry="16" className="ill-line" />

      <House x={132} y={97} w={26} />
      <House x={164} y={93} w={30} />
      <House x={200} y={98} w={24} />
      <path d="M232 114V102" className="ill-stroke" strokeWidth="2" />
      <circle cx="232" cy="98" r="7" className="ill-ink" />
      <path d="M118 114V105" className="ill-stroke" strokeWidth="2" />
      <circle cx="118" cy="101" r="6" className="ill-ink" />

      {/* Bouclier de veille */}
      <g className="ta-float">
        <path d="M62 44 84 52V70C84 84 74 93 62 98C50 93 40 84 40 70V52Z" className="ill-ink" />
        <path
          d="M52 70 59 77 73 61"
          fill="none"
          className="ill-stroke-paper"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <g className="ta-drift">
        <path
          d="M188 30q5 -5 10 0q5 -5 10 0M214 20q4 -4 8 0q4 -4 8 0"
          fill="none"
          className="ill-stroke"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * « Mes villages » : maisons, épingle rouge et cloche qui sonne — suivre un lieu pour être
 * prévenu. Suit le thème (classes ill-*).
 */
export function FollowVillagesSpot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true" className={className}>
      <ellipse cx="66" cy="95" rx="62" ry="11" className="ill-mist" />
      <House x={18} y={74} w={24} />
      <House x={50} y={67} w={30} />
      <House x={88} y={76} w={22} />

      <g className="ta-bob">
        <path
          d="M65 51C61 45 53 40 53 31a12 12 0 0 1 24 0c0 9 -8 14 -12 20Z"
          fill={RED}
          className="ill-stroke"
          strokeWidth="2"
        />
        <circle cx="65" cy="31" r="4.5" className="ill-paper" />
      </g>

      <g className="ta-ring" style={{ transformOrigin: '132px 22px' }}>
        <path
          d="M132 14c-7 0 -11 5 -11 12v8l-3 5h28l-3 -5v-8c0 -7 -4 -12 -11 -12Z"
          className="ill-ink"
        />
        <circle cx="132" cy="43" r="3.5" className="ill-ink" />
      </g>
      <path
        d="M112 18a22 22 0 0 0 0 20M152 18a22 22 0 0 1 0 20"
        fill="none"
        stroke={RED}
        strokeWidth="2.5"
        strokeLinecap="round"
        className="ta-blink"
      />
    </svg>
  );
}
