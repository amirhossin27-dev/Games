// Joyboy Service Worker: App offline verfügbar machen.
// Neuer Name: main.tsx legt hier auch die Dateien des ersten Besuchs ab
const CACHE = 'joyboy-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Zeitabgleich für das Spielzeit-Limit nie aus dem Cache beantworten
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.searchParams.has('__time')) return;

  // Seitenaufrufe: erst Netzwerk (für Updates), sonst die gespeicherte App.
  if (request.mode === 'navigate' && request.destination !== 'iframe' && !url.pathname.includes('Joy-Kart-PC')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true })),
    );
    return;
  }

  // Dateien (JS, CSS, Schriften, Icons): aus dem Cache, im Hintergrund aktualisieren.
  event.respondWith(
    // ignoreVary: statische Dateien hängen nicht vom Origin-Header ab (Modul-Skripte schicken ihn mit)
    caches.match(request, { ignoreVary: true }).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
