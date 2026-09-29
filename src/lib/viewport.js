// iOS home-screen apps can lay out shorter than the screen at launch (vh, dvh,
// svh and innerHeight all under-report), leaving a black band under the tab
// bar. A standalone app always fills the screen, so size to the screen there.
const standalone = () =>
  navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches

function fit() {
  if (!standalone()) return
  const portrait = window.innerHeight >= window.innerWidth
  const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
  const h = Math.max(window.innerHeight, screenH)
  const root = document.documentElement.style
  root.setProperty('--app-h', `${h}px`)
  // Fixed layers anchor to the short viewport, so they reach down by the gap.
  root.setProperty('--app-gap', `${h - window.innerHeight}px`)
}

export function fitViewport() {
  fit()
  for (const ev of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(ev, fit)
  document.addEventListener('visibilitychange', fit)
}
