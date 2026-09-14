const CACHE_VERSION = "v18";
const CACHE_NAME = "acreetionos-v18";
const STATIC_ASSETS = [
  "/", "/404.html", "/about.html", "/beginner.html", "/changelog.html",
  "/community-reviews.html", "/compare.html", "/contact.html",
  "/contributors.html", "/docs.html", "/faq.html", "/features.html",
  "/flash.html", "/governance.html", "/hosting.html", "/immutable.html",
  "/index.html", "/lightweight.html", "/newsletter.html", "/privacy.html",
  "/requirements.html", "/status.html", "/unofficial.html",
  "/styles.css?v=20260826", "/sidebar.css?v=20260825", "/contact.css?v=20260825",
  "/acreetionoslogo.webp", "/logo.webp"
];

// Tell the page it is looking at a cached copy (triggers the disclosure bubble).
function notifyServedFromCache(request) {
  try {
    request.clientId && self.clients.get(request.clientId).then(function (client) {
      client && client.postMessage({ type: "SERVED_FROM_CACHE" });
    });
  } catch (e) {}
}

self.addEventListener("install", function (t) {
  t.waitUntil(
    caches.open(CACHE_NAME).then(function (e) {
      return Promise.allSettled(STATIC_ASSETS.map(function (p) { return e.add(p); }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (t) {
  t.waitUntil(
    caches.keys().then(function (e) {
      return Promise.all(
        e.filter(function (s) { return s !== CACHE_NAME; }).map(function (s) { return caches.delete(s); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (t) {
  const r = t.request;
  const e = new URL(r.url);

  // Only handle same-origin requests.
  if (e.origin !== self.location.origin) return;

  // Never intercept /cdn-cgi/ (Cloudflare internals).
  if (e.pathname.startsWith("/cdn-cgi/")) return;

  // API POST -> always network.
  if (r.method === "POST" && e.pathname.startsWith("/api/")) {
    t.respondWith(fetch(r.clone()));
    return;
  }

  // Non-GET -> always network.
  if (r.method !== "GET") {
    t.respondWith(fetch(r));
    return;
  }

  // API GET -> always network (live data: news, stats, counter, etc.).
  if (e.pathname.startsWith("/api/")) {
    t.respondWith(fetch(r));
    return;
  }

  // HTML documents, root, and JS -> network-first, fall back to cache.
  if (e.pathname.endsWith(".html") || e.pathname === "/" || e.pathname === "" || e.pathname.endsWith(".js")) {
    t.respondWith(
      fetch(r)
        .then(function (s) {
          if (s && s.status === 200) {
            const h = s.clone();
            caches.open(CACHE_NAME).then(function (a) { a.put(r, h); });
          }
          return s;
        })
        .catch(function () {
          // Offline / network failure: serve cached copy and disclose it.
          notifyServedFromCache(r);
          return caches.match(r);
        })
    );
    return;
  }

  // Other static assets -> cache-first, then network (fill cache).
  t.respondWith(
    caches.match(r).then(function (s) {
      if (s) return s;
      return fetch(r).then(function (h) {
        if (h && h.status === 200) {
          const a = h.clone();
          caches.open(CACHE_NAME).then(function (l) { l.put(r, a); });
        }
        return h;
      });
    })
  );
});

self.addEventListener("message", function (t) {
  if (t.data && t.data.type === "SKIP_WAITING") self.skipWaiting();
});
