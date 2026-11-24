const CACHE_NAME = 'enxoval-baby-v1';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  const url = new URL(request.url);

  // Cache-first for app shell and static assets
  if (request.method === 'GET' && (request.destination === 'image' || request.destination === 'style' || request.destination === 'script' || SHELL_URLS.includes(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  // Network-first for data (indexed-stores.json), fall back to cache
  if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/Enxoval-Baby/data/')) {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request)),
    );
    return;
  }

  // Default: network first
  event.respondWith(fetch(request));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
});
