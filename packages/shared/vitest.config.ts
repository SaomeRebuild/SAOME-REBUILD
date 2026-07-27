import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/*.ts'],
      exclude: ['**/*.test.ts', 'bdd/**', 'index.ts', 'i18n/**'],
    },
  },
  resolve: {
    alias: {
      '@saome/shared': '.',
    },
  },
});
