import { useState, useEffect, useRef } from 'react'

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

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e) => {
    e.preventDefault()
    const v = value.trim()
    if (v) onSubmit(v)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
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
