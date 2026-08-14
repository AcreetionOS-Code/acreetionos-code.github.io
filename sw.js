// Service Worker for caching and offline support
const CACHE_VERSION = 'v10';
const CACHE_NAME = `acreetionos-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/404.html',
  '/about.html',
  '/beginner.html',
  '/changelog.html',
  '/community-reviews.html',
  '/compare.html',
  '/contact.html',
  '/contributors.html',
  '/docs.html',
  '/faq.html',
  '/features.html',
  '/flash.html',
  '/git-tracker.html',
  '/governance.html',
  '/hosting.html',
  '/immutable.html',
  '/index.html',
  '/lightweight.html',
  '/newsletter.html',
  '/privacy.html',
  '/requirements.html',
  '/status.html',
  '/unofficial.html',
  '/wiki.html',
  '/styles.css',
  '/sidebar.css',
  '/fonts.css',
  '/contact.css',
  '/acreetionoslogo.webp',
  '/logo.webp',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass service worker for Cloudflare edge endpoints
  if (url.pathname.startsWith('/cdn-cgi/')) {
    return;
  }

  // Forward all POST API requests directly without caching
  if (event.request.method === 'POST' && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request.clone()));
    return;
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for HTML and JS: always fetch fresh, fall back to cache if offline
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '' || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, CSS)
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// Listen for messages from pages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
