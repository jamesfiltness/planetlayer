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
    fs: { allow: ['..'] }, // lets the dev server serve ../shared, which the server uses too
  },
  build: { chunkSizeWarningLimit: 1500 }, // maplibre-gl alone is ~1 MB
});
