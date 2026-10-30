import { defineConfig } from 'vitest/config';

// Tests unitaires de la logique pure (sans dépendance React Native).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
