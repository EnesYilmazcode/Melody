import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted variable font (bundled by Vite, precached for offline use).
import '@fontsource-variable/bricolage-grotesque/standard.css'
import App from './App.jsx'
import './index.css'
import { seedIfEmpty, removeSamples } from './lib/seed'
import { requestPersistentStorage } from './lib/db'
import { registerServiceWorker } from './lib/pwa'
import { fitViewport } from './lib/viewport'

fitViewport()

// In dev we seed sample tones to develop against; in the real (prod) app there
// are no samples — and we clean up any that were seeded by earlier builds.
if (import.meta.env.DEV) seedIfEmpty().catch(() => {})
else removeSamples().catch(() => {})

// Ask iOS to mark our storage durable at startup (not just on import), so the
// imported songs/playlists/stars in IndexedDB are far less likely to be evicted
// while the app sits unused. This is what makes removing/re-adding the icon
// unnecessary — and unsafe, since on iOS that can drop the origin's storage.
requestPersistentStorage().catch(() => {})

// Register the service worker and keep it checking for new deploys, so the app
// updates itself in place (see pwa.js) instead of needing a home-screen reinstall.
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
