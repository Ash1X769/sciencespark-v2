const CACHE_NAME = 'sciencespark-v2';
const PRECACHE = [
  '/sciencespark-v2/',
  '/sciencespark-v2/index.html',
  '/sciencespark-v2/manifest.json',
  '/sciencespark-v2/icon-192.png',
  '/sciencespark-v2/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

self.addEventListener('push', event => {
  let data = { title: 'ScienceSpark', body: 'Time to study! 📚' };
  try { data = JSON.parse(event.data?.text() || '{}'); } catch(_) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'ScienceSpark', {
      body: data.body || '',
      icon: data.icon || '/sciencespark-v2/icon-192.png',
      badge: '/sciencespark-v2/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: self.location.origin + '/sciencespark-v2/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/sciencespark-v2/'));
});
