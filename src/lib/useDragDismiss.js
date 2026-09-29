import { useEffect, useRef } from 'react'

// Drag-down-to-dismiss for sheets and Now Playing. Reports the finger's
// downward travel through onDrag(dy) and, on release, onEnd(dy, velocity in
// px/ms). A drag only starts downward, never on `exclude` targets, and inside a
// [data-scroll] area only when that area is scrolled to its top, so scrollers
// and scrubbers keep their own gestures. Touch drives it on the phone; the
// mouse path exists for desktop and headless tests.
export function useDragDismiss(ref, { onDrag, onEnd, exclude = 'input, textarea, [data-nodrag]' }) {
  const cb = useRef()
  cb.current = { onDrag, onEnd }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let s = null
    let justDragged = false

    const begin = (x, y, target) => {
      if (target.closest?.(exclude)) return
      const sc = target.closest?.('[data-scroll]')
      s = { x, y, sc: sc && el.contains(sc) ? sc : null, dragging: false, samples: [] }
    }
    // Returns true when the event should be swallowed.
    const move = (x, y) => {
      if (!s) return false
      const dx = x - s.x
      const dy = y - s.y
      if (!s.dragging) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return false
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || (s.sc && s.sc.scrollTop > 0)) {
          s = null
          return false
        }
        s.dragging = true
        s.y = y
      }
      const d = Math.max(0, y - s.y)
      s.samples.push({ d, t: performance.now() })
      if (s.samples.length > 5) s.samples.shift()
      cb.current.onDrag?.(d)
      return true
    }
    const end = () => {
      if (s?.dragging) {
        const a = s.samples[0]
        const b = s.samples[s.samples.length - 1]
        const v = a && b && b.t > a.t ? (b.d - a.d) / (b.t - a.t) : 0
        justDragged = true
        setTimeout(() => { justDragged = false }, 50)
        cb.current.onEnd?.(b ? b.d : 0, v)
      }
      s = null
    }

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) { s = null; return }
      begin(e.touches[0].clientX, e.touches[0].clientY, e.target)
    }
    const onTouchMove = (e) => {
      if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault()
    }
    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      begin(e.clientX, e.clientY, e.target)
      const mm = (ev) => move(ev.clientX, ev.clientY)
      const up = () => {
        window.removeEventListener('pointermove', mm)
        window.removeEventListener('pointerup', up)
        end()
      }
      window.addEventListener('pointermove', mm)
      window.addEventListener('pointerup', up)
    }
    // A drag that ends over a button must not also press it.
    const onClick = (e) => {
      if (justDragged) { e.stopPropagation(); e.preventDefault() }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref, exclude])
}
