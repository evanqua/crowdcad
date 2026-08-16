import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit-test config for pure TS/logic modules under src/. This is intentionally
// separate from Playwright: e2e specs live under tests/e2e and are owned by
// playwright.config.ts / playwright.config.pocketbase.ts — do not point this
// config at that directory.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**'],
  },
});
