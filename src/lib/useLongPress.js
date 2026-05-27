import { useRef } from 'react'

// Long-press (touch hold or right-click) → onLongPress. Returns handlers to
// spread on an element plus suppressClick(), which the element's onClick calls
// first so a long-press doesn't also fire the normal tap action.
export function useLongPress(onLongPress, delay = 450) {
  const timer = useRef(null)
  const fired = useRef(false)

  const start = () => {
    fired.current = false
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress()
    }, delay)
  }
  const cancel = () => clearTimeout(timer.current)

  return {
    handlers: {
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchMove: cancel,
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onContextMenu: (e) => {
        e.preventDefault()
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
