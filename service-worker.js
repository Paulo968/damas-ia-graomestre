const CACHE_NAME = "damas-ia-v9";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/game-core.js",
  "/worker-code.js",
  "/ui-init.js",
  "/supabase-adapter.js",
  "/audio-engine.js",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isAppFile =
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".json");

  if (isAppFile) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((res) => res || fetch(req))
  );
});
