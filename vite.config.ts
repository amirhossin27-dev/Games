import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relativer Basis-Pfad, damit die App lokal und auf GitHub Pages (/Games/) läuft.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Alle Spiele stecken in einem Paket, damit Joyboy nach dem ersten Laden auch offline komplett ist.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
  },
});
