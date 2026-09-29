import { useState } from 'react'
import { useUI } from '../state/UIProvider'
import { usePlaylists } from '../state/useLibrary'
import { usePlayer } from '../state/PlayerProvider'
import { addToPlaylist, createPlaylist, toggleStar, deleteTrack, removeFromPlaylist } from '../lib/db'
import { displayTitle } from '../lib/series'
import Sheet from './Sheet'
import Artwork from './Artwork'
import Icon from './Icon'
import PromptModal from './PromptModal'
import ConfirmModal from './ConfirmModal'

// Track sheet (hold a row, or ⋯ → Add to playlist in Now Playing): quick
// playback actions, the playlist picker, and delete. Rendered once at the root.
export default function AddToPlaylistSheet() {
  const { addTarget, fromPlaylist, closeAddToPlaylist } = useUI()
  const playlists = usePlaylists()
  const { playNext, addToQueue, current } = usePlayer()
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // The sheet unmounts on close, but the modals it opens outlive it.
  const [target, setTarget] = useState(null)
  if (!addTarget && !target) return null
  const track = addTarget || target

  const addToList = async (id) => {
    await addToPlaylist(id, track.id)
  }

  return (
    <>
      {addTarget && (
        <Sheet onClose={closeAddToPlaylist} label={displayTitle(track)}>
          {(close) => (
            <>
              <div className="sheet__grp sheet__grp--fixed">
                <div className="sheet__head">
                  <Artwork track={track} size={40} />
                  <span className="sheet__headtitle">{displayTitle(track)}</span>
                </div>
                {current && current.id !== track.id && (
                  <>
                    <button className="sheet__row" onClick={() => close(() => playNext(track))}>
                      <span>Play next</span><Icon name="playnext" size={20} />
                    </button>
                    <button className="sheet__row" onClick={() => close(() => addToQueue(track))}>
                      <span>Add to queue</span><Icon name="queue" size={20} />
                    </button>
                  </>
                )}
                <button className="sheet__row" onClick={() => close(() => toggleStar(track.id).catch(() => {}))}>
                  <span>{track.starred ? 'Remove from favorites' : 'Add to favorites'}</span>
                  <Icon name={track.starred ? 'star' : 'starline'} size={20} />
                </button>
                {fromPlaylist && (
                  <button className="sheet__row" onClick={() => close(() => removeFromPlaylist(fromPlaylist.id, track.id).catch(() => {}))}>
                    <span>Remove from {fromPlaylist.name}</span><Icon name="minus" size={20} />
                  </button>
                )}
              </div>

              <div className="sheet__grp sheet__grp--scroll" data-scroll>
                <p className="sheet__label" style={{ boxShadow: 'none' }}>Add to playlist</p>
                <button className="sheet__row sheet__row--accent" onClick={() => { setTarget(track); setCreating(true); close() }}>
                  <span>New playlist</span><Icon name="plus" size={20} />
                </button>
                {(playlists || []).map((p) => {
                  const has = p.trackIds.includes(track.id)
                  return (
                    <button key={p.id} className="sheet__row" onClick={() => !has && close(() => addToList(p.id))} disabled={has} aria-label={has ? `${p.name}, added` : p.name}>
                      <span>{p.name}</span>
                      {has ? <Icon name="check" size={20} className="check" /> : <span className="sheet__count num">{p.trackIds.length}</span>}
                    </button>
                  )
                })}
              </div>

              {track.srcType === 'idb' && (
                <div className="sheet__grp sheet__grp--fixed">
                  <button className="sheet__row sheet__row--danger" onClick={() => { setTarget(track); setConfirmDelete(true); close() }}>
                    <span>Delete from library</span><Icon name="trash" size={20} />
                  </button>
                </div>
              )}

              <div className="sheet__grp sheet__grp--fixed">
                <button className="sheet__row sheet__row--c" onClick={() => close()}>Cancel</button>
              </div>
            </>
          )}
        </Sheet>
      )}

      {creating && (
        <PromptModal
          title="New playlist"
          placeholder="Playlist name"
          onClose={() => { setCreating(false); setTarget(null) }}
          onSubmit={async (name) => {
            const id = await createPlaylist(name)
            await addToList(id)
            setCreating(false)
            setTarget(null)
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete from library?"
          message={`“${displayTitle(track)}” and its audio will be removed from this phone. This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteTrack(track.id)
            setConfirmDelete(false)
            setTarget(null)
          }}
          onClose={() => { setConfirmDelete(false); setTarget(null) }}
        />
      )}
    </>
  )
}
