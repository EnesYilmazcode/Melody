import { useDialog } from '../lib/useDialog'

// Destructive confirm dialog (e.g. delete a playlist) — replaces window.confirm.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onClose,
}) {
  const dialog = useDialog(onClose)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        ref={dialog.ref}
        onKeyDown={dialog.onKeyDown}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal__title">{title}</h3>
        {message && <p className="modal__msg">{message}</p>}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
