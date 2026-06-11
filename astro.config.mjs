// @ts-check
import 'dotenv/config';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: 'standalone' }),
  i18n: {
    locales: ['nb', 'en'],
    defaultLocale: 'nb',
    routing: { prefixDefaultLocale: true },
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()]
  }
});