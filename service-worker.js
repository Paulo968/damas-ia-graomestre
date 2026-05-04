const CACHE_NAME = "damas-ia-v1";

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
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
