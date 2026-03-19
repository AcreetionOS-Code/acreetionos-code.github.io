// Service Worker for aggressive caching and offline support
const CACHE_VERSION = 'v2';
const CACHE_NAME = `acreetionos-${CACHE_VERSION}`;

const AIDEN_URL = 'https://aiden.acreetionos.org';
const CHECK_INTERVAL = 5 * 60 * 1000;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/contact.html',
  '/selfhelp.html',
  '/docs.html',
  '/contact.css',
  '/contact.js',
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
  scheduleAidenCheck();
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
  scheduleAidenCheck();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
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

let checkTimer = null;

function scheduleAidenCheck() {
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(checkAidenOnline, 30000);
}

async function checkAidenOnline() {
  try {
    const response = await fetch(AIDEN_URL, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store'
    });
    await notifySubscribers(true);
  } catch (e) {
  }
  scheduleAidenCheck();
}

async function notifySubscribers(isOnline) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  for (const client of clients) {
    client.postMessage({
      type: 'AIDEN_STATUS',
      online: isOnline
    });
  }
}

// Listen for messages from pages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
