import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// NOTE on `base`: production is served from a SUBPATH, so the built asset URLs
// must be prefixed with it or the deployed app loads a blank white screen (the
// JS/CSS 404). The live deploy is Firebase via `npm run deploy:sparky`, hosted
// at https://sparkylab.web.app/melody/ — so '/melody/' (lowercase) is correct.
// Local dev uses '/'.
//
// ⚠️ If you ever switch to GitHub Pages instead, the path is case-SENSITIVE and
// preserves the repo name: https://enesyilmazcode.github.io/Melody/ — you'd
// need base '/Melody/' (capital M), or rename the repo to lowercase. Don't
// change this to '/Melody/' while deploying to Firebase — that would break it.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/melody/' : '/',
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate' = the new service worker activates and reloads the page as
      // soon as a new build is detected. This directly solves your §7 worry
      // ("works offline but I don't want stale builds"): the app shell is cached
      // for offline use, but a fresh deploy supersedes the cache automatically.
      registerType: 'autoUpdate',

      // Files copied as-is into the build (favicon, apple-touch-icon, etc.).
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],

      // This object becomes the generated manifest.json. iOS reads `name`,
      // `icons`, `theme_color`, and `display: standalone` to render a real
      // fullscreen app (no Safari chrome) when you Add to Home Screen.
      manifest: {
        name: 'Melody',
        short_name: 'Melody',
        description: 'Personal local audio player',
        theme_color: '#110f0c',
        background_color: '#110f0c',
        display: 'standalone',
        orientation: 'portrait',
        // Relative scope/start so it works under the /melody/ subpath.
        scope: '.',
        start_url: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      // Workbox config: precache the app shell so Melody opens with no network
      // (the whole point — bad subway wifi). Audio files are NOT precached here;
      // they live in Files and load on demand (Phase 3/6).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        // Cache YouTube cover thumbnails after first view so artwork shows
        // offline on the subway.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'yt-thumbs',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },

      // Lets the service worker run on `npm run dev` so you can test
      // installability/offline locally before deploying.
      devOptions: { enabled: true },
    }),
  ],
}))
