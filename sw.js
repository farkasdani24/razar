// Nagyon egyszerű service worker: csak azért kell, hogy az app telefonra
// telepíthető legyen. Nem cache-el, mindig a friss változatot tölti be.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
