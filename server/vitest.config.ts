import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    // Integration tests start GDAL and PostGIS work; the defaults are too tight.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
      reporter: ['text', 'html'],
    },
  },
  // Vitest's own transform doesn't emit decorator metadata, which Nest's
  // dependency injection reads.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
