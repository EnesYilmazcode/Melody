import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// One source image -> all the PWA/iOS icon sizes. Regenerate with:
//   npm run generate-icons
//
// The apple-touch-icon and maskable icon are overridden to fill with the app's
// dark background (#110f0c) instead of the generator's default WHITE — that
// white fill is what put a white border around the icon on the iOS home screen.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // iOS home-screen icon: full-bleed dark tile (the logo already has its own
    // rounded dark field + inset bars, so no extra padding needed).
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: '#110f0c' },
    },
    // Android maskable: keep safe-zone padding, but on a dark field.
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { background: '#110f0c' },
    },
  },
  images: ['public/logo.svg'],
})
