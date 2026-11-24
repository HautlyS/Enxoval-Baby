const CACHE_NAME = 'enxoval-baby-v1';
const BASE = '/Enxoval-Baby/';
const SHELL_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  const url = new URL(request.url);
  const path = url.pathname;

  // Cache-first for app shell and static assets
  if (request.method === 'GET' &&
      (request.destination === 'image' ||
       request.destination === 'style' ||
       request.destination === 'script' ||
       path === BASE ||
       path === BASE + 'index.html' ||
       path === BASE + 'favicon.ico' ||
       path.startsWith(BASE + 'src/') ||
       path.startsWith(BASE + 'data/'))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
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
