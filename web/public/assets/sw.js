const CACHE = 'clan-static-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('clan-static-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache private APIs, sessions, or page navigations.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    request.mode === 'navigate'
  )
    return;
  if (
    !url.pathname.startsWith('/assets/') &&
    !url.pathname.startsWith('/icons/') &&
    !url.pathname.endsWith('.js') &&
    !url.pathname.endsWith('.css')
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })(),
  );
});
