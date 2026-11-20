import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
    // One in-memory mongod is shared, so keep files sequential.
    fileParallelism: false,
  },
});
