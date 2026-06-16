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
