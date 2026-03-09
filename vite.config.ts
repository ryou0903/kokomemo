import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ここメモ',
        short_name: 'ここメモ',
        description: '場所を簡単に登録・ナビゲーションできるメモアプリ',
        theme_color: '#2563eb',
        background_color: '#fffbf5',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // アプリ更新時に古いキャッシュを自動削除
        cleanupOutdatedCaches: true,
        // 古いService Workerのキャッシュもクリア
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Google Maps JavaScript API - NetworkFirstで常に最新を優先
            urlPattern: /^https:\/\/maps\.googleapis\.com\/maps\/api\/js/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-maps-api',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24, // 1日
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Google Maps タイル - StaleWhileRevalidateで高速表示しつつ更新
            urlPattern: /^https:\/\/maps\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-maps-tiles',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 3, // 3日に短縮
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Places API (REST) - NetworkFirst
            urlPattern: /^https:\/\/places\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-places-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1時間
              },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  base: '/kokomemo/',
})
