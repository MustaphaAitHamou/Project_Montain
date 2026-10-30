// Données de DÉMONSTRATION : événements FICTIFS, marqués is_demo = true et « [DÉMO] ».
// Ils ne sont visibles que si le réglage demo_mode est activé, ne déclenchent aucune
// notification (exclus de l'outbox et du ciblage) et sont supprimés par demo:clear.
import { rest, resolveTarget, setDemoMode } from './lib.mjs';

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const note = (text) => `[DÉMO] Événement fictif à des fins de démonstration. ${text}`;

const EVENTS = [
  {
    sub: 'fire.smoke',
    status: 'under_review',
    severity: 'vigilance',
    source: 'community',
    lat: 36.6358,
    lng: 4.2023,
    h: 2,
    n: 'Fumée signalée au-dessus d’une crête.',
  },
  {
    sub: 'fire.spread_documented',
    status: 'corroborated',
    severity: 'important',
    source: 'community',
    lat: 36.5105,
    lng: 4.5401,
    h: 5,
    n: 'Plusieurs signalements concordants.',
  },
  {
    sub: 'flood.submerged_road',
    status: 'received',
    severity: 'vigilance',
    source: 'community',
    lat: 36.7511,
    lng: 5.0567,
    h: 1,
    n: 'Chaussée submergée signalée.',
  },
  {
    sub: 'earthquake.felt',
    status: 'confirmed',
    severity: 'information',
    source: 'seismic',
    lat: 36.62,
    lng: 4.9,
    h: 20,
    n: 'Secousse ressentie (valeurs fictives).',
    magnitude: 3.4,
    depth: 10,
  },
  {
    sub: 'traffic.road_closed',
    status: 'confirmed',
    severity: 'vigilance',
    source: 'official',
    lat: 36.4625,
    lng: 4.5328,
    h: 8,
    n: 'Route fermée (exemple).',
  },
  {
    sub: 'utilities.water_outage',
    status: 'corroborated',
    severity: 'information',
    source: 'community',
    lat: 36.7169,
    lng: 4.0497,
    h: 30,
    n: 'Coupure d’eau signalée.',
  },
  {
    sub: 'weather.snow',
    status: 'resolved',
    severity: 'vigilance',
    source: 'community',
    lat: 36.4545,
    lng: 4.2662,
    h: 70,
    n: 'Épisode terminé.',
    ended: 10,
  },
];

const target = resolveTarget();
const rows = EVENTS.map((e) => ({
  category_id: e.sub.split('.')[0],
  subcategory_id: e.sub,
  status: e.status,
  severity: e.severity,
  source_kind: e.source,
  is_public: true,
  is_demo: true,
  location: `SRID=4326;POINT(${e.lng} ${e.lat})`,
  location_uncertainty_m: e.source === 'community' ? 500 : 0,
  public_note: note(e.n),
  started_at: hoursAgo(e.h),
  last_activity_at: hoursAgo(Math.max(0, e.h - 1)),
  ended_at: e.ended ? hoursAgo(e.ended) : null,
  magnitude: e.magnitude ?? null,
  depth_km: e.depth ?? null,
  details: { demo: true },
}));

const inserted = await rest(target, 'alert_events', {
  method: 'POST',
  body: rows,
  prefer: 'return=representation',
});
await setDemoMode(target, true);
console.log(
  `${inserted.length} événements DÉMO fictifs créés sur ${target.host} ; réglage demo_mode activé.`,
);
console.log('Côté web, définissez aussi NEXT_PUBLIC_DEMO_MODE=true pour afficher le bandeau DÉMO.');
console.log('Suppression : pnpm demo:clear');
