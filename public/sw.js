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
