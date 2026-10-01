// SHAKEMOI - Service worker minimal.
// Il rend l'app installable (Chrome Android l'exige pour créer l'appli) et
// affiche une page propre hors connexion. Il ne met AUCUNE ressource de l'app
// en cache : chaque ouverture charge la dernière version publiée.

const OFFLINE_CACHE = 'shakemoi-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(cache => cache.addAll([OFFLINE_URL, '/icon-192.png'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== OFFLINE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  // Seules les navigations (ouverture d'une page) passent par ici, et
  // seulement pour afficher la page hors connexion en cas d'échec réseau.
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

// Notification push (P7) : arrive même appli fermée. Si l'appli est déjà à
// l'écran, on ne double pas avec une notif système (les pastilles suffisent).
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'SHAKEmoi';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const visible = list.some(c => c.visibilityState === 'visible' && c.focused);
      if (visible && !data.force) return;
      return self.registration.showNotification(title, options);
    }),
  );
});

// Toucher une notification ouvre l'appli au bon endroit (post, conversation,
// cercle, story, profil) : l'adresse porte la cible (?open=…).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const client = list.find(c => new URL(c.url).origin === self.location.origin) || list[0];
      if (client) {
        client.postMessage({ type: 'shakemoi:open', url });
        return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Abonnement renouvelé par le navigateur : l'appli le réenregistre à la prochaine ouverture.
self.addEventListener('pushsubscriptionchange', () => {});
