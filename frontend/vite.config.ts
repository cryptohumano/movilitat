import type { PluginOption } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
  ];
  // PWA solo en producción: en dev no cargamos el plugin para no generar sw.js
  if (mode === 'production') {
    plugins.push(
      VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
              name: 'Movilitat - Transporte Público Digital',
              short_name: 'Movilitat',
              description: 'Sistema de digitalización para transporte público',
              theme_color: '#0f172a',
              background_color: '#0f172a',
              display: 'standalone',
              orientation: 'portrait',
              scope: '/',
              start_url: '/',
              icons: [
                { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              navigateFallbackDenylist: [/^\/api\//],
              runtimeCaching: [
                // /api/* siempre a la red (validate, login, etc.); el SW no cachea ni intercepta mal
                {
                  urlPattern: /\/api\/.*/i,
                  handler: 'NetworkOnly',
                },
                {
                  urlPattern: /^https:\/\/api\./i,
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'api-cache',
                    expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
                    cacheableResponse: { statuses: [0, 200] },
                  },
                },
              ],
            },
          })
    );
  }
  return {
  plugins,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
};
});
