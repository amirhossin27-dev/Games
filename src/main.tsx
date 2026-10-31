import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/grandstander';
import '@fontsource/andika/400.css';
import '@fontsource/andika/700.css';
import './styles.css';
import './arcade/arcade.css';
import { App } from './App';

// Wie eine App: langes Drücken öffnet kein Browser-Menü (außer in Eingabefeldern)
document.addEventListener('contextmenu', (e) => {
  if (!(e.target instanceof Element && e.target.closest('input, textarea'))) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline-Unterstützung und „Zum Home-Bildschirm“ (nur in der fertigen App)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(async () => {
        // Was beim ersten Besuch schon geladen wurde, sieht der Service Worker nicht – gleich mit merken,
        // damit Joyboy schon nach dem ersten Öffnen offline läuft. (Name wie CACHE in public/sw.js)
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && !u.includes('__time'));
        const cache = await caches.open('joyboy-v2');
        await Promise.all(
          [...new Set(urls)].map(async (u) => {
            if (!(await cache.match(u, { ignoreVary: true }))) await cache.add(u).catch(() => undefined);
          }),
        );
      })
      .catch(() => {
        // ohne Service Worker läuft die App trotzdem
      });
  });
}
