const CACHE = "problem-space-v3";

async function appAssets() {
  const indexUrl = new URL("./index.html", self.location);
  const response = await fetch(indexUrl);
  const html = await response.clone().text();
  const discovered = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !path.startsWith("#"))
    .map((path) => new URL(path, indexUrl))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
  const problemData = new URL("./data/problems.json", self.location).href;
  return { response, urls: [...new Set([new URL("./", self.location).href, indexUrl.href, problemData, ...discovered])] };
}

self.addEventListener("install", (event) => {
  event.waitUntil(appAssets().then(async ({ response, urls }) => {
    const cache = await caches.open(CACHE);
    await cache.put(new URL("./index.html", self.location), response);
    await cache.addAll(urls.filter((url) => url !== new URL("./index.html", self.location).href));
    await self.skipWaiting();
  }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  })));
});
