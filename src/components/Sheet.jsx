import { useCallback, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../lib/useDialog'
import { useDragDismiss } from '../lib/useDragDismiss'
import { motionMs, EASE_SHEET } from '../lib/motion'

// Bottom action sheet: slides up, drags down to dismiss, and animates out on
// every close path. Children may be a function receiving close(), so an
// action can dismiss with the same animation.
export default function Sheet({ onClose, label, children }) {
  const panel = useRef(null)
  const overlay = useRef(null)
  const closed = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const dur = motionMs(380)

  const slide = (to, ms = dur) => {
    const el = panel.current
    if (!el) return
    el.style.transition = ms ? `transform ${ms}ms ${EASE_SHEET}` : 'none'
    el.style.transform = to
  }

  useLayoutEffect(() => {
    slide('translateY(calc(100% + 16px))', 0)
    panel.current.getBoundingClientRect() // commit the start position
    slide('')
  }, [])

  const close = useCallback((then) => {
    if (closed.current) return
    closed.current = true
    slide('translateY(calc(100% + 16px))', motionMs(280))
    overlay.current?.classList.add('is-closing')
    setTimeout(() => {
      onCloseRef.current?.()
      if (typeof then === 'function') then()
    }, motionMs(260))
  }, [])

  useDragDismiss(panel, {
    onDrag: (d) => slide(`translateY(${d}px)`, 0),
    onEnd: (d, v) => (d > 110 || v > 0.5 ? close() : slide('')),
  })

  const dialog = useDialog(() => close(), { autoFocus: true })

  return createPortal(
    <>
      <div className="sheet-overlay" ref={overlay} onClick={() => close()} />
      <div
        className="sheet"
        ref={(el) => { panel.current = el; dialog.ref.current = el }}
        onKeyDown={dialog.onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {typeof children === 'function' ? children(close) : children}
      </div>
    </>,
    document.body,
  )
}
