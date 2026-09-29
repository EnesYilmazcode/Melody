import { useEffect, useState } from 'react'
import { usePlaylists, useTracks } from '../state/useLibrary'
import { createPlaylist, renamePlaylist, deletePlaylist } from '../lib/db'
import { usePlayer } from '../state/PlayerProvider'
import { useUI } from '../state/UIProvider'
import { useLongPress } from '../lib/useLongPress'
import { formatTotalDuration, formatTime } from '../lib/format'
import { displayTitle } from '../lib/series'
import { shuffle } from '../lib/shuffle'
import Artwork from './Artwork'
import TrackRow from './TrackRow'
import Icon from './Icon'
import PromptModal from './PromptModal'
import ConfirmModal from './ConfirmModal'
import PlaylistActionsSheet from './PlaylistActionsSheet'

export default function PlaylistsView({ scrollRef }) {
  const playlists = usePlaylists()
  const allTracks = useTracks() // resolves each row's cover + duration meta
  const { playlistId: openId, setPlaylistId: setOpenId } = useUI()
  const [creating, setCreating] = useState(false)
  const [actionsFor, setActionsFor] = useState(null) // playlist in the ⋯ sheet
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const open = playlists?.find((p) => p.id === openId)
  // Resolve ids the same way PlaylistDetail does, dropping dangling ids:
  // deleted or restored-but-not-reimported tracks must not inflate the counts.
  const byId = allTracks && new Map(allTracks.map((t) => [t.id, t]))
  const resolve = (p) => p.trackIds.map((id) => byId.get(id)).filter(Boolean)

  // A new view starts at the top.
  useEffect(() => {
    if (scrollRef?.current) scrollRef.current.scrollTop = 0
  }, [openId, scrollRef])

  if (playlists === undefined || allTracks === undefined) return <section className="view" />

  return (
    <section className="view">
      {open ? (
        <PlaylistDetail
          playlist={open}
          tracks={resolve(open)}
          scrollRef={scrollRef}
          onBack={() => setOpenId(null)}
          onActions={() => setActionsFor(open)}
        />
      ) : (
        <>
          <div className="topbar">
            <button className="iconbtn" onClick={() => setCreating(true)} aria-label="New playlist">
              <Icon name="plus" size={24} />
            </button>
          </div>

          {playlists.length === 0 ? (
            <div className="emptystate">
              <Icon name="tab_playlists" size={44} />
              <h2>No playlists yet</h2>
              <p>Make one, then press and hold any song to add it.</p>
              <button className="btn btn--accent" onClick={() => setCreating(true)}>New playlist</button>
            </div>
          ) : (
            <div className="list">
              {playlists.map((p) => (
                <PlaylistRow
                  key={p.id}
                  playlist={p}
                  tracks={resolve(p)}
                  onOpen={() => setOpenId(p.id)}
                  onLongPress={() => setActionsFor(p)}
                />
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
          count={resolve(actionsFor).length}
          onClose={() => setActionsFor(null)}
          onRename={() => setRenaming(actionsFor)}
          onDelete={() => setDeleting(actionsFor)}
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
          message={`“${deleting.name}” will be removed. Your songs stay in the library.`}
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

/** "12 songs, 48 min" with the numbers in the numeric voice. */
function Meta({ tracks }) {
  const n = tracks.length
  const dur = formatTotalDuration(tracks.reduce((s, t) => s + (t.duration || 0), 0))
  return (
    <>
      <span className="num">{n}</span> {n === 1 ? 'song' : 'songs'}{dur && <>, {dur}</>}
    </>
  )
}

// 2×2 of the first four covers when there are four; otherwise the first one.
function Mosaic({ tracks, size = 56 }) {
  if (tracks.length >= 4) {
    return (
      <span className="mosaic" aria-hidden="true">
        {tracks.slice(0, 4).map((t) => <Artwork key={t.id} track={t} size={size / 2} radius={0} />)}
      </span>
    )
  }
  return (
    <span className="mosaic mosaic--one" aria-hidden="true">
      <Artwork track={tracks[0]} size={size} radius={0} />
    </span>
  )
}

function PlaylistRow({ playlist, tracks, onOpen, onLongPress }) {
  const lp = useLongPress(onLongPress)
  return (
    <button className="row plrow plcard" {...lp.handlers} onClick={() => { if (!lp.suppressClick()) onOpen() }}>
      <Mosaic tracks={tracks} />
      <span className="row__text">
        <span className="row__title">{playlist.name}</span>
        <span className="row__sub"><Meta tracks={tracks} /></span>
      </span>
      <Icon name="chev" size={14} className="chev" />
    </button>
  )
}

function PlaylistDetail({ playlist, tracks, scrollRef, onBack, onActions }) {
  const { playQueue, current, isPlaying } = usePlayer()
  const [scrolled, setScrolled] = useState(false)

  // The compact bar shows the name once the big title scrolls away.
  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    const on = () => setScrolled(el.scrollTop > 190)
    on()
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [scrollRef])

  const source = { name: playlist.name, playlistId: playlist.id }
  // Shuffle doesn't bookmark: the next Resume should follow playlist order.
  const inOrder = { playlistId: playlist.id, source }
  const resumeIdx = playlist.resume ? tracks.findIndex((t) => t.id === playlist.resume.trackId) : -1
  const resumeTrack = resumeIdx >= 0 ? tracks[resumeIdx] : null
  // No point offering to resume what is already playing.
  const showResume = resumeTrack && !(isPlaying && current?.id === resumeTrack.id)

  return (
    <>
      <div className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <button className="iconbtn" onClick={onBack} aria-label="Back"><Icon name="back" size={24} /></button>
        <span className="navbar__title">{playlist.name}</span>
        <button className="iconbtn" onClick={onActions} aria-label="Playlist options"><Icon name="more" size={22} /></button>
      </div>

      <div className="hero">
        <Mosaic tracks={tracks} size={200} />
        <h1>{playlist.name}</h1>
        {tracks.length > 0 && <p className="hero__meta"><Meta tracks={tracks} /></p>}
      </div>

      {tracks.length > 0 ? (
        <>
          <div className="btnrow">
            <button className="btn" onClick={() => playQueue(tracks, 0, inOrder)}><Icon name="play" size={18} /> Play</button>
            <button className="btn" onClick={() => playQueue(shuffle(tracks), 0, { source })}><Icon name="shuffle" size={20} /> Shuffle</button>
          </div>
          {showResume && (
            <button
              className="resume"
              onClick={() => playQueue(tracks, resumeIdx, { ...inOrder, startAt: playlist.resume.position })}
            >
              <Icon name="play" size={20} />
              <span className="resume__text">
                <span className="resume__label">Continue</span>
                <span className="resume__title">{displayTitle(resumeTrack)}</span>
              </span>
              <span className="resume__time num">{formatTime(playlist.resume.position)}</span>
            </button>
          )}
          <div className="list">
            {tracks.map((t) => (
              <TrackRow key={t.id} track={t} list={tracks} playOpts={inOrder} playlist={playlist} />
            ))}
          </div>
        </>
      ) : (
        <p className="hint">Empty for now. Press and hold any song in Library or Search to add it here.</p>
      )}
    </>
  )
}
