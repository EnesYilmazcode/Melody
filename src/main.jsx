import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted variable font (bundled by Vite, precached for offline use).
import '@fontsource-variable/bricolage-grotesque'
import App from './App.jsx'
import './index.css'
import { seedIfEmpty, removeSamples } from './lib/seed'

// In dev we seed sample tones to develop against; in the real (prod) app there
// are no samples — and we clean up any that were seeded by earlier builds.
if (import.meta.env.DEV) seedIfEmpty()
else removeSamples()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
