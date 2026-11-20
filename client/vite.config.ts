/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.VITE_API_URL ?? 'http://localhost:4100';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // The browser only ever talks to its own origin, so the auth cookie is first-party
      // in development exactly as it is in production.
      proxy: { '/api': { target: api, changeOrigin: false } },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['src/test-setup.ts'],
      css: false,
    },
  };
});
