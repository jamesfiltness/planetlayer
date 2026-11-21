import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The Host header is passed on unchanged (`changeOrigin: false`; the string
    // shorthand would rewrite it), so it still matches the browser's Origin and
    // the server's cross-site check (server/http/hostGuard.js) accepts writes.
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: false } },
    // The dev server may serve only the client and ../shared (which the server
    // uses too), not the rest of the repository, as it can be shared on the
    // network with `npm run dev -- --host`.
    fs: { allow: [import.meta.dirname, path.join(import.meta.dirname, '../shared')] },
  },
  build: { chunkSizeWarningLimit: 1500 }, // maplibre-gl alone is ~1 MB
});
