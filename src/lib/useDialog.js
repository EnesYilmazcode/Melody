import { useEffect, useRef } from 'react'

// Shared modal / bottom-sheet accessibility. Returns { ref, onKeyDown } to put
// on the dialog element (the caller also adds role="dialog" aria-modal="true").
// It moves focus into the dialog on open and closes on Escape. Escape is handled
// at the element (not window), so when a modal is stacked over a sheet only the
// focused top-most dialog reacts — the one underneath doesn't also close.
// Background scrolling is already locked globally by
// body { position: fixed; overflow: hidden }, so this doesn't re-lock it.
// `active` distinguishes conditionally-mounted dialogs (default true — focus on
// mount) from an always-mounted host that only *renders* the dialog when open
// (pass active=open, so focus moves in each time it opens, not once at startup).
export function useDialog(onClose, { autoFocus = true, active = true } = {}) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus && active) ref.current?.focus()
  }, [autoFocus, active])
  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose?.()
  }
  return { ref, onKeyDown }
}
