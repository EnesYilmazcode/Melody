import { useState, useEffect, useRef } from 'react'
import { useDialog } from '../lib/useDialog'

// A small centered text-entry modal — replaces window.prompt() so naming a
// playlist feels native and on-brand instead of a browser system dialog.
// Submits on Enter or the confirm button; closes on backdrop tap, Cancel, or Esc.
export default function PromptModal({
  title,
  placeholder = '',
  confirmLabel = 'Create',
  initialValue = '',
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef(null)
  // autoFocus:false — we focus the text input, not the form container.
  const dialog = useDialog(onClose, { autoFocus: false })

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (e) => {
    e.preventDefault()
    const v = value.trim()
    if (v) onSubmit(v)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal"
        ref={dialog.ref}
        onKeyDown={dialog.onKeyDown}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="modal__title">{title}</h3>
        <input
          ref={inputRef}
          className="modal__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoCapitalize="words"
          autoCorrect="off"
          enterKeyHint="done"
          maxLength={60}
        />
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--accent" disabled={!value.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  )
}
