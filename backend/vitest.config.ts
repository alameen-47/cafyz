import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    sequence: { concurrent: false },
    reporters: ['verbose'],
    env: {
      NODE_ENV: 'test',
      TURSO_URL: ':memory:',
      JWT_SECRET: 'test-secret',
    },
  },
});
