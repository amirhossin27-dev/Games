// Joyboy Service Worker: App offline verfügbar machen.
const CACHE = 'joyboy-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Joys Stimme (joyboy-voice-…) verwaltet die App selbst – nicht löschen
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith('joyboy-voice')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Zeitabgleich für das Spielzeit-Limit nie aus dem Cache beantworten
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.searchParams.has('__time')) return;
  // Joys Stimm-Modelle (je 63 MB) speichert die App selbst, nicht doppelt hier
  if (url.pathname.includes('/voice/models/')) return;

  // Seitenaufrufe: erst Netzwerk (für Updates), sonst die gespeicherte App.
  if (request.mode === 'navigate') {
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
