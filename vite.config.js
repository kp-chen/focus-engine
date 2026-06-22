import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app is fully client-side with no network/runtime dependencies, so it can
// be precached and run completely offline. registerType 'autoUpdate' swaps in a
// new service worker as soon as the next build is deployed.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Register from the app bundle (virtual:pwa-register in main.jsx) rather
      // than an injected inline <script>, which the site CSP (script-src 'self',
      // no unsafe-inline) would block.
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cognitive Toolkit',
        short_name: 'Cognitive',
        description: 'Audio-modulation and cognitive-training tools for focus, calm, and deep rest.',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell + fonts + icons + the voices manifest. The voice
        // MP3s (~11 MB across all voices) are NOT precached — they're runtime-
        // cached on first use (below), so only the voice you actually play is
        // stored offline, not every option.
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,json}'],
        // SPA: serve index.html for navigations when offline.
        navigateFallback: '/',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/voices/') && url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'voice-audio',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
