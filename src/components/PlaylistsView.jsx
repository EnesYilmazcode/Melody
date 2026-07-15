import { useState } from 'react'
import { usePlaylists, useTracks } from '../state/useLibrary'
import { createPlaylist, renamePlaylist, deletePlaylist, removeFromPlaylist } from '../lib/db'
import { usePlayer } from '../state/PlayerProvider'
import { useLongPress } from '../lib/useLongPress'
import { summarize } from '../lib/format'
import { shuffle } from '../lib/shuffle'
import TrackRow from './TrackRow'
import PromptModal from './PromptModal'
import ConfirmModal from './ConfirmModal'
import PlaylistActionsSheet from './PlaylistActionsSheet'

export default function PlaylistsView() {
  const playlists = usePlaylists()
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [actionsFor, setActionsFor] = useState(null) // playlist in the ⋯ sheet
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const open = playlists?.find((p) => p.id === openId)

  return (
    <section className="view">
      {playlists === undefined ? (
        <p className="dim">Loading…</p>
      ) : open ? (
        <PlaylistDetail playlist={open} onBack={() => setOpenId(null)} onActions={() => setActionsFor(open)} />
      ) : (
        <>
          {/* Same header shape the detail view uses, so nothing shifts. */}
          <header className="phead">
            <h1>Playlists</h1>
            <button className="btn btn--accent" onClick={() => setCreating(true)}>+ New</button>
          </header>

          {playlists.length === 0 ? (
            <p className="dim">No playlists yet. Create one, then add tracks with the ⋯ menu. Hold a playlist to rename or delete it.</p>
          ) : (
            <div className="list">
              {playlists.map((p) => (
                <PlaylistCard key={p.id} playlist={p} onOpen={() => setOpenId(p.id)} onLongPress={() => setActionsFor(p)} />
              ))}
            </div>
          )}
        </>
      )}

      {creating && (
        <PromptModal
          title="New playlist"
          placeholder="Playlist name"
          onClose={() => setCreating(false)}
          onSubmit={async (name) => {
            const id = await createPlaylist(name)
            setCreating(false)
            setOpenId(id)
          }}
        />
      )}

      {actionsFor && (
        <PlaylistActionsSheet
          playlist={actionsFor}
          onClose={() => setActionsFor(null)}
          onRename={() => { setRenaming(actionsFor); setActionsFor(null) }}
          onDelete={() => { setDeleting(actionsFor); setActionsFor(null) }}
        />
      )}

      {renaming && (
        <PromptModal
          title="Rename playlist"
          confirmLabel="Rename"
          initialValue={renaming.name}
          onClose={() => setRenaming(null)}
          onSubmit={async (name) => { await renamePlaylist(renaming.id, name); setRenaming(null) }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete playlist?"
          message={`“${deleting.name}” will be removed. Your tracks stay in the library.`}
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deletePlaylist(deleting.id)
            if (openId === deleting.id) setOpenId(null)
            setDeleting(null)
          }}
        />
      )}
    </section>
  )
}

function PlaylistCard({ playlist, onOpen, onLongPress }) {
  const lp = useLongPress(onLongPress)
  return (
    <button
      className="plcard"
      {...lp.handlers}
      onClick={() => { if (!lp.suppressClick()) onOpen() }}
    >
      <span className="plcard__name">{playlist.name}</span>
      <span className="dim">{playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}</span>
    </button>
  )
}

function PlaylistDetail({ playlist, onBack, onActions }) {
  const allTracks = useTracks()
  const { playQueue } = usePlayer()
  if (allTracks === undefined) return <p className="dim">Loading…</p>

  // Resolve ids → track objects in saved order, dropping any since-deleted ids.
  const byId = new Map(allTracks.map((t) => [t.id, t]))
  const tracks = playlist.trackIds.map((id) => byId.get(id)).filter(Boolean)
  const shuffled = () => shuffle(tracks)

  return (
    <>
      <header className="phead">
        <button className="iconbtn phead__back" onClick={onBack} aria-label="Back"><ChevronLeft /></button>
        <h1>{playlist.name}</h1>
        <button className="iconbtn" onClick={onActions} aria-label="Playlist options"><Dots /></button>
      </header>

      {tracks.length > 0 ? (
        <>
          <p className="phead__meta dim">{summarize(tracks)}</p>
          <div className="row-actions">
            <button className="btn btn--accent playall" onClick={() => playQueue(tracks, 0)}><PlayGlyph /> Play</button>
            <button className="btn btn--ghost playall" onClick={() => playQueue(shuffled(), 0)}><ShuffleGlyph /> Shuffle</button>
          </div>
          <div className="list">
            {tracks.map((t) => (
              <div key={t.id} className="plrow">
                <TrackRow track={t} list={tracks} />
                <button className="iconbtn" onClick={() => removeFromPlaylist(playlist.id, t.id)} aria-label="Remove from playlist">−</button>
              </div>
            ))}
          </div>
          <p className="dim hint">Tip: set the loop button to ⟳ all to loop this playlist.</p>
        </>
      ) : (
        <p className="dim">Empty playlist. Add tracks from Library or Search using the ⋯ menu.</p>
      )}
    </>
  )
}

function PlayGlyph() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> }
function ShuffleGlyph() { return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5M21 3l-7 7M4 20l16-16M16 21h5v-5M15 15l6 6M4 4l5 5" /></svg> }
function ChevronLeft() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg> }
function Dots() { return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg> }
