import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Integration tests run against TEST_DATABASE_URL when set; otherwise they are skipped.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test',
      KAFKA_ENABLED: 'false',
      CORS_ORIGINS: 'https://app.bank.com,https://*.partners.bank.com',
    },
  },
});
