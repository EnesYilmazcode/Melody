import { registerSW } from 'virtual:pwa-register'

// How often to re-check the server for a fresh build while the app stays open.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000 // 1h

// Registers the service worker and — the important part — keeps nudging it to
// look for new builds.
//
// vite.config.js uses registerType:'autoUpdate', so once a new build is found
// the worker activates and reloads the page on its own; the user never has to
// remove/re-add the home-screen icon. The catch on iOS: a standalone PWA is
// FROZEN and later RESUMED rather than genuinely reloaded, so Safari's built-in
// update check frequently never fires and the app looks stale for days. We work
// around that by explicitly calling registration.update() on a timer while the
// app is open AND every time it returns to the foreground — which is exactly the
// moment an iOS user reopens Melody expecting the latest version.
export function registerServiceWorker() {
  return registerSW({
    immediate: true,
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return

      const check = () => registration.update().catch(() => {})

      // Periodic check for long-lived sessions (e.g. left open playing music).
      setInterval(check, UPDATE_INTERVAL_MS)

      // The one that matters on iOS: re-check the instant the app is resumed.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
