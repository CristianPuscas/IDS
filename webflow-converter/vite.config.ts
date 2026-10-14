import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build works from any sub-path (GitHub Pages, artifact hosting, file server).
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    // jsdom provides DOMParser / document for the engine's HTML parsing and for clipboard tests.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
