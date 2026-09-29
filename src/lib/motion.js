// Duration for JS-driven transitions; near zero when the user asked for less motion.
export function motionMs(ms) {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 1
  } catch { /* old engines */ }
  return ms
}

export const EASE_SHEET = 'cubic-bezier(.32, .72, 0, 1)'
