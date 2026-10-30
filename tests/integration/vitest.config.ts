import { defineConfig } from 'vitest/config';

// Les tests partagent une base réelle : exécution séquentielle, délais généreux.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: ['src/globalSetup.ts'],
  },
});
