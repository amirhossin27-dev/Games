import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/grandstander';
import '@fontsource/andika/400.css';
import '@fontsource/andika/700.css';
import './styles.css';
import './arcade/arcade.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline-Unterstützung und „Zum Home-Bildschirm“ (nur in der fertigen App)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ohne Service Worker läuft die App trotzdem
    });
  });
}
