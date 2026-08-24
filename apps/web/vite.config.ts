import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

import { resolveApiBaseUrl } from './src/lib/api-base-url';
import { createWebSecurityHeaders } from './src/lib/security-headers';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, '.', '');
  const apiBaseUrl = resolveApiBaseUrl(environment.VITE_API_BASE_URL, mode === 'production');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['terminal.local'],
    },
    preview: {
      headers: createWebSecurityHeaders(apiBaseUrl, mode === 'production'),
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  };
});
