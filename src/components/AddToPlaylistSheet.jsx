import { useState } from 'react'
import { useUI } from '../state/UIProvider'
import { usePlaylists } from '../state/useLibrary'
import { usePlayer } from '../state/PlayerProvider'
import { addToPlaylist, createPlaylist, toggleStar, deleteTrack } from '../lib/db'
import PromptModal from './PromptModal'
import ConfirmModal from './ConfirmModal'

// Track actions sheet (opened from a TrackRow's ⋯). Quick playback actions on
// top (Play next / Add to queue / Favorite), then the "add to playlist" picker.
export default function AddToPlaylistSheet() {
  const { addTarget, closeAddToPlaylist } = useUI()
  const playlists = usePlaylists()
  const { playNext, addToQueue } = usePlayer()
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!addTarget) return null

  const close = closeAddToPlaylist
  const addToList = async (id) => {
    await addToPlaylist(id, addTarget.id)
    close()
  }

  return (
    <>
      <div className="sheet-overlay" onClick={close}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__grip" />
          <p className="sheet__title">{addTarget.title}</p>

          <button className="sheet__item" onClick={() => { playNext(addTarget); close() }}>
            <span>Play next</span><Glyph d="M5 4l7 5-7 5zM14 4v10" />
          </button>
          <button className="sheet__item" onClick={() => { addToQueue(addTarget); close() }}>
            <span>Add to queue</span><Glyph d="M3 5h10M3 9h10M3 13h6M14 11v6M14 17l3-2M14 17l-3-2" />
          </button>
          <button className="sheet__item" onClick={() => { toggleStar(addTarget.id); close() }}>
            <span>{addTarget.starred ? 'Remove from favorites' : 'Add to favorites'}</span>
            <Glyph filled={!!addTarget.starred} d="M9 1.5l2.2 4.5 5 .7-3.6 3.5.85 5L9 12.9 4.7 15.2l.85-5L2 6.7l5-.7z" />
          </button>

          <p className="sheet__label">Add to playlist</p>
          <button className="sheet__item sheet__item--new" onClick={() => setCreating(true)}>
            + New playlist
          </button>
          {(playlists || []).map((p) => {
            const has = p.trackIds.includes(addTarget.id)
            return (
              <button key={p.id} className="sheet__item" onClick={() => !has && addToList(p.id)} disabled={has}>
                <span>{p.name}</span>
                <span className="dim">{has ? '✓ added' : `${p.trackIds.length}`}</span>
              </button>
            )
          })}

          {addTarget.srcType === 'idb' && (
            <button
              className="sheet__item sheet__item--danger"
              onClick={() => setConfirmDelete(true)}
            >
              <span>Delete from library</span>
              <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h12M7 5V3h4v2M6 5l.8 10h4.4L12 5" /></svg>
            </button>
          )}

          <button className="btn btn--ghost sheet__cancel" onClick={close}>Cancel</button>
        </div>
      </div>

      {creating && (
        <PromptModal
          title="New playlist"
          placeholder="Playlist name"
          onClose={() => setCreating(false)}
          onSubmit={async (name) => {
            const id = await createPlaylist(name)
            setCreating(false)
            await addToList(id)
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete from library?"
          message={`"${addTarget.title}" and its downloaded audio will be removed. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteTrack(addTarget.id)
            setConfirmDelete(false)
            close()
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

function Glyph({ d, filled }) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
