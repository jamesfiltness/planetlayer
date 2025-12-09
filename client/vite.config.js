import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // `..` lets the dev server serve ../shared, which the server uses too.
  server: { proxy: { '/api': 'http://localhost:8080' }, fs: { allow: ['..'] } },
  build: { chunkSizeWarningLimit: 1500 }, // maplibre-gl alone is ~1 MB
});
