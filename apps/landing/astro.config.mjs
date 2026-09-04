import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const { PUBLIC_SITE_URL } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  'PUBLIC_',
);

export default defineConfig({
  site: PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || undefined,
  output: 'static',
  integrations: [react()],
  server: {
    host: true,
    allowedHosts: ['qably.dev', 'www.qably.dev', '.qably.dev', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: true,
    allowedHosts: ['qably.dev', 'www.qably.dev', '.qably.dev', 'localhost', '127.0.0.1'],
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['qably.dev', 'www.qably.dev', '.qably.dev', 'localhost', '127.0.0.1'],
    },
    preview: {
      allowedHosts: ['qably.dev', 'www.qably.dev', '.qably.dev', 'localhost', '127.0.0.1'],
    },
  },
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
