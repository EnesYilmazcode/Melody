// Bottom sheet for a single playlist — opened by long-pressing a playlist card
// or tapping ⋯ inside a playlist. Offers Rename and Delete.
export default function PlaylistActionsSheet({ playlist, onRename, onDelete, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        <p className="sheet__title">{playlist.name}</p>

        <button className="sheet__item" onClick={onRename}>
          <span>Rename</span>
          <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3l4 4L6 16H2v-4z" /><path d="M10 4l4 4" /></svg>
        </button>
        <button className="sheet__item sheet__item--danger" onClick={onDelete}>
          <span>Delete playlist</span>
          <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h12M7 5V3h4v2M6 5l.8 10h4.4L12 5" /></svg>
        </button>

        <button className="btn btn--ghost sheet__cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
