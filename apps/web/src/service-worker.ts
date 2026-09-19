/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { assets, immutable, prerendered } from "$app/manifest";
import { version } from "$app/env";

declare let self: ServiceWorkerGlobalScope;

const CACHE_NAME = `choreloop-${version}`;

// Everything Vite built (js/css), everything in `static/`, plus any
// prerendered pages, so navigation requests have something to fall back to
// when offline. Manifest paths are relative to the service worker's own
// location, so normalize them to absolute pathnames for matching in `fetch`.
const PRECACHE_URLS = [
  "/",
  ...[...immutable, ...assets, ...prerendered].map((entry) => `/${entry.path}`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for navigations (so users get fresh content when online),
// falling back to the cache when offline. Cache-first for everything else
// we precached (build output, static assets).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const cached = (await caches.match(event.request)) ?? (await caches.match("/"));
          if (cached) return cached;
          throw new Error("No cached response available for navigation fallback");
        }
      })(),
    );
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((response) => response ?? fetch(event.request)));
  }
});
