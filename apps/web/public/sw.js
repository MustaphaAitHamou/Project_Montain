/*
 * Service worker Tamurt Alerte :
 *  - notifications push du navigateur (Web Push) ;
 *  - repli hors connexion : en cas d'échec réseau sur une navigation, la page « hors ligne »
 *    est affichée. Aucune donnée d'alerte n'est mise en cache ici (évite d'afficher des
 *    alertes anciennes comme actuelles).
 */
const OFFLINE_CACHE = 'tamurt-offline-v1';
const OFFLINE_URL = '/hors-ligne';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Tamurt Alerte', body: '', data: {} };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Charge utile non JSON : notification générique.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data,
      icon: '/icon.svg',
      badge: '/icon.svg',
      lang: 'fr',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
