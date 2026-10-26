import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  // Public base path. Defaults to '/'; the GitHub Pages workflow sets BASE_PATH=/<repo-name>/
  // so assets resolve under the project sub-path (e.g. BASE_PATH=/IDS/ npm run build).
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    // terser (used only for scripts over the 50,000-character Code Embed limit) is a lazy chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(terser|@jridgewell|acorn|source-map)/.test(id)) return 'terser';
          return undefined;
        },
      },
    },
  },
  test: {
    // jsdom provides DOMParser / document for the engine's HTML parsing and for clipboard tests.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
