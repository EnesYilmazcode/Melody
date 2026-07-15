import { useRef } from 'react'

// Long-press (touch hold or right-click) → onLongPress. Returns handlers to
// spread on an element plus suppressClick(), which the element's onClick calls
// first so a long-press doesn't also fire the normal tap action.
export function useLongPress(onLongPress, delay = 450) {
  const timer = useRef(null)
  const fired = useRef(false)
  const startPos = useRef(null)
  const touchedAt = useRef(0)
  const MOVE_TOLERANCE = 10 // px of finger jitter allowed before we treat it as a scroll

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const begin = (e, isTouch) => {
    // Ignore the synthetic mouse events iOS fires right after a touch, so a
    // touch long-press isn't followed by a phantom mouse "tap" that resets
    // `fired` and lets the tap action slip through.
    if (!isTouch && Date.now() - touchedAt.current < 600) return
    if (timer.current) return // already holding
    fired.current = false
    const pt = e.touches?.[0]
    startPos.current = pt ? { x: pt.clientX, y: pt.clientY } : null
    timer.current = setTimeout(() => {
      timer.current = null
      fired.current = true
      onLongPress()
    }, delay)
  }

  // Cancel only on real movement — a held finger always jitters a few px, and
  // the old zero-tolerance onTouchMove:cancel made long-press fire only ~half
  // the time.
  const move = (e) => {
    if (!timer.current || !startPos.current) return
    const pt = e.touches?.[0]
    if (!pt) return
    const dx = pt.clientX - startPos.current.x
    const dy = pt.clientY - startPos.current.y
    if (dx * dx + dy * dy > MOVE_TOLERANCE * MOVE_TOLERANCE) clear()
  }

  return {
    handlers: {
      onTouchStart: (e) => begin(e, true),
      onTouchEnd: () => {
        clear()
        touchedAt.current = Date.now()
      },
      onTouchMove: move,
      onTouchCancel: clear, // a system-interrupted touch must not leave the timer armed
      onMouseDown: (e) => begin(e, false),
      onMouseUp: clear,
      onMouseLeave: clear,
      onContextMenu: (e) => {
        e.preventDefault()
        clear()
        fired.current = true
        onLongPress()
      },
    },
    suppressClick: () => {
      const f = fired.current
      fired.current = false
      return f
    },
  }
}
