// Supprime toutes les données marquées is_demo = true et désactive le réglage demo_mode.
import { rest, resolveTarget, setDemoMode } from './lib.mjs';

const target = resolveTarget();
const events = await rest(target, 'alert_events?is_demo=eq.true', {
  method: 'DELETE',
  prefer: 'return=representation',
});
const posts = await rest(target, 'community_assistance?is_demo=eq.true', {
  method: 'DELETE',
  prefer: 'return=representation',
});
await setDemoMode(target, false);
console.log(
  `${events.length} événement(s) et ${posts.length} annonce(s) DÉMO supprimés sur ${target.host} ; demo_mode désactivé.`,
);
