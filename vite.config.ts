import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// App-Stand für den Elternbereich: wann gebaut und aus welchem Commit (in GitHub Actions gesetzt).
// So sieht man auf dem Handy, ob schon die neueste Version läuft.
const builtAt = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const appStand = `${builtAt} Uhr · ${(env.GITHUB_SHA ?? 'lokal').slice(0, 7)}`;

// Relativer Basis-Pfad, damit die App lokal und auf GitHub Pages (/Games/) läuft.
export default defineConfig({
  base: './',
  define: { __APP_STAND__: JSON.stringify(appStand) },
  plugins: [react()],
  // Alle Spiele stecken in einem Paket, damit Joyboy nach dem ersten Laden auch offline komplett ist.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
  },
});
